import copy
import importlib.util
import json
import types
from pathlib import Path
from unittest.mock import AsyncMock

import aiohttp
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('comfy_builder', ROOT/'scripts/build_comfyui_tool.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def load():
    recipe = json.loads((ROOT/'tests/fixtures/comfy_krea_square.recipe.json').read_text(encoding='utf8'))
    exported = builder.build(recipe)
    module = types.ModuleType('comfy_test')
    exec(compile(exported['content'], '<workflow>', 'exec'), module.__dict__)
    return recipe, module.Tools(), exported


def test_only_bound_inputs_change():
    recipe, tool, exported = load()
    original = copy.deepcopy(recipe['workflow'])
    graph = tool._graph('A tiny robot')
    assert graph['51']['inputs']['text'] == 'A tiny robot'
    assert 0 <= graph['53']['inputs']['seed'] < 2**53
    graph['51']['inputs']['text'] = original['51']['inputs']['text']
    graph['53']['inputs']['seed'] = original['53']['inputs']['seed']
    assert graph == original
    assert recipe['workflow'] == original
    assert exported['access_grants'] == []


def test_shared_seed_and_required_image():
    recipe, tool, _ = load()
    recipe['workflow']['99'] = {'class_type':'LoadImage','inputs':{'image':'fixed.png','noise_seed':1}}
    recipe['seed_inputs'].append({'node':'99','key':'noise_seed'})
    recipe['image_inputs'] = [{'node':'99','key':'image'}]
    exported = builder.build(recipe)
    module = types.ModuleType('comfy_images')
    exec(exported['content'], module.__dict__)
    tool = module.Tools()
    with pytest.raises(ValueError, match='requires an image'):
        tool._graph('edit')
    graph = tool._graph('edit','uploaded.png')
    assert graph['99']['inputs']['noise_seed'] == graph['53']['inputs']['seed']
    assert graph['99']['inputs']['image'] == 'uploaded.png'


@pytest.mark.parametrize('change', ['canvas','linked','duplicate'])
def test_reject_invalid_bindings(change):
    recipe, _, _ = load()
    if change == 'canvas': recipe['workflow'] = {'nodes':[]}
    if change == 'linked': recipe['prompt_inputs'] = [{'node':'52','key':'width'}]
    if change == 'duplicate': recipe['prompt_inputs'] *= 2
    with pytest.raises(ValueError): builder.build(recipe)


def test_template_text_is_never_executed():
    recipe, _, _ = load()
    literal = '__SERVER_LITERAL__\n"\nraise RuntimeError("injected")\n'
    recipe['workflow']['51']['inputs']['text'] = literal
    module = types.ModuleType('literal')
    exec(builder.build(recipe)['content'], module.__dict__)
    assert module.RECIPE['workflow']['51']['inputs']['text'] == literal


def entry(user='owner', tool='comfy_krea_square'):
    return {'prompt':[1,'own',{}, {'openwebui_workflow':{'user_id':user,'tool_id':tool}}], 'outputs':{'29':{'images':[{'filename':'own.png'}]},'999':{'images':[{'filename':'unselected.png'}]}}}


async def test_ownership_and_only_selected_outputs():
    _, tool, _ = load()
    assert not tool._belongs(entry('other'), {'id':'owner'})
    assert not tool._belongs(entry(tool='another_workflow'), {'id':'owner'})
    tool._store = AsyncMock(return_value={'url':'/api/v1/files/own/content','filename':'own.png'})
    result = await tool._finish(None,entry(),'own',object(),{'id':'owner'},None)
    assert tool._store.await_count == 1
    assert tool._store.await_args.args[1]['filename'] == 'own.png'
    assert '/api/v1/files/own/content' in result
    with pytest.raises(ValueError,match='another user'):
        await tool._finish(None,entry('other'),'own',object(),{'id':'owner'},None)
    assert tool._store.await_count == 1


async def test_error_is_not_published():
    _, tool, _ = load()
    failed = entry()
    failed['status'] = {'status_str':'error','messages':[['execution_error',{'node_id':'53','exception_message':'out of memory'}]]}
    tool._store = AsyncMock()
    with pytest.raises(RuntimeError,match='node 53: out of memory'):
        await tool._finish(None,failed,'own',object(),{'id':'owner'},None)
    tool._store.assert_not_called()


async def test_images_attach_without_relying_on_model_markdown():
    _, tool, _ = load()
    saved = {'url':'/api/v1/files/own/content','filename':'own.png'}
    tool._store = AsyncMock(return_value=saved)
    emitter = AsyncMock()
    result = await tool._finish(None,entry(),'own',object(),{'id':'owner'},emitter)
    attachments = [call.args[0] for call in emitter.await_args_list if call.args[0]['type']=='files']
    assert attachments == [{'type':'files','data':{'files':[{'type':'image',**saved}]}}]
    assert json.loads(result)['images']==[saved]
    assert 'already attached' in json.loads(result)['message']
    assert '![' not in result


async def test_resume_checks_ownership_and_never_submits(monkeypatch):
    _, tool, _ = load()
    async def get(self,url,**kwargs):
        data = {} if '/history/' in url else {'queue_running':[[1,'wrong',{}, {'openwebui_workflow':{'user_id':'other','tool_id':'comfy_krea_square'}}]],'queue_pending':[]}
        return httpx.Response(200,json=data,request=httpx.Request('GET',url))
    post = AsyncMock(side_effect=AssertionError('must not submit'))
    monkeypatch.setattr(httpx.AsyncClient,'get',get)
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    result = await tool._run('','',object(),{'id':'owner'},None,existing='wrong')
    assert 'Job not found' in result
    post.assert_not_called()

@pytest.mark.parametrize('uncertain', [True, False])
async def test_submit_once_and_recover_without_duplicate(monkeypatch, uncertain):
    _, tool, _ = load()
    calls=[]
    async def get(self,url,**kwargs):
        return httpx.Response(200,json={},request=httpx.Request('GET',url))
    async def post(self,url,**kwargs):
        calls.append(kwargs['json'])
        if uncertain: raise httpx.ReadTimeout('lost submission response')
        return httpx.Response(200,json={'prompt_id':'accepted-job'},request=httpx.Request('POST',url))
    async def no_socket(*args,**kwargs): raise aiohttp.ClientConnectionError('socket offline')
    monkeypatch.setattr(httpx.AsyncClient,'get',get)
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    monkeypatch.setattr(aiohttp.ClientSession,'ws_connect',no_socket)
    tool._watch=AsyncMock(side_effect=httpx.ReadTimeout('history unavailable'))
    result=await tool._run('robot','',object(),{'id':'owner'},None)
    assert len(calls)==1
    assert calls[0]['extra_data']['openwebui_workflow']['user_id']=='owner'
    assert calls[0]['extra_data']['extra_pnginfo']['openwebui_workflow']['id']=='comfy_krea_square'
    assert 'workflow' not in calls[0]['extra_data']['extra_pnginfo']
    if uncertain:
        assert 'No confirmed job ID' in result
        tool._watch.assert_not_called()
    else:
        assert 'accepted-job' in result and 'Do not resubmit' in result


async def test_socket_ignores_other_jobs_and_shows_own_sampling(monkeypatch):
    _, tool, exported=load()
    module=types.ModuleType('socket_test');exec(exported['content'],module.__dict__)
    tool=module.Tools()
    ticks=[0]
    def monotonic(): ticks[0]+=0.3;return ticks[0]
    module.time=types.SimpleNamespace(monotonic=monotonic)
    frames=[
        {'type':'progress','data':{'prompt_id':'other','value':99,'max':100}},
        {'type':'execution_start','data':{'prompt_id':'own'}},
        {'type':'progress','data':{'prompt_id':'own','value':3,'max':8}},
    ]
    class Socket:
        closed=False
        async def receive(self):
            packet=frames.pop(0) if frames else {'type':'status','data':{}}
            return types.SimpleNamespace(type=aiohttp.WSMsgType.TEXT,data=json.dumps(packet))
    queries=[0]
    async def get(url,**kwargs):
        queries[0]+=1
        return httpx.Response(200,json={'own':entry()} if queries[0]>=3 else {},request=httpx.Request('GET',url))
    events=[]
    async def emit(event):events.append(event)
    tool._finish=AsyncMock(return_value='done')
    result=await tool._watch(types.SimpleNamespace(get=get),'own',object(),{'id':'owner'},emit,Socket())
    assert result=='done'
    descriptions=[e['data']['description'] for e in events if e['type']=='status']
    assert any('3/8' in s for s in descriptions)
    assert not any('99/100' in s for s in descriptions)

async def test_model_retries_are_blocked_per_turn_but_new_turn_allowed(monkeypatch):
    _,tool,_=load()
    async def get(self,url,**kwargs):return httpx.Response(200,json={},request=httpx.Request('GET',url))
    calls=[]
    async def post(self,url,**kwargs):
        calls.append(kwargs['json'])
        return httpx.Response(200,json={'prompt_id':'job-'+str(len(calls))},request=httpx.Request('POST',url))
    async def no_socket(*args,**kwargs):raise aiohttp.ClientConnectionError()
    monkeypatch.setattr(httpx.AsyncClient,'get',get)
    monkeypatch.setattr(httpx.AsyncClient,'post',post)
    monkeypatch.setattr(aiohttp.ClientSession,'ws_connect',no_socket)
    tool._watch=AsyncMock(side_effect=RuntimeError('Invalid encoder; administrator must fix graph'))
    request=types.SimpleNamespace(app=types.SimpleNamespace(state=types.SimpleNamespace()))
    metadata={'chat_id':'chat','message_id':'turn-one'}
    first=await tool._run('robot','',request,{'id':'owner'},None,metadata=metadata)
    retry=await tool._run('simpler robot','',request,{'id':'owner'},None,metadata=metadata)
    assert len(calls)==1 and first==retry
    await tool._run('robot','',request,{'id':'owner'},None,metadata={**metadata,'message_id':'turn-two'})
    assert len(calls)==2
    await tool._run('robot','',request,{'id':'someone-else'},None,metadata=metadata)
    assert len(calls)==3

@pytest.mark.parametrize('ratio,tier,expected',[('16:9','2K',(2048,1152)),('9:16','1K',(576,1024)),('1:1','2K',(2048,2048)),('2:3','2K',(1368,2048))])
def test_approved_ratio_and_resolution_preserve_other_nodes(ratio,tier,expected):
    recipe,tool,_=load()
    graph=tool._graph('robot',options={'aspect_ratio':ratio,'resolution':tier,'steps':12})
    assert (graph['52']['inputs']['width'],graph['52']['inputs']['height'])==expected
    assert graph['53']['inputs']['steps']==12
    assert graph['73']==recipe['workflow']['73']
    assert graph['72']==recipe['workflow']['72']
    assert graph['53']['inputs']['sampler_name']=='euler'
    assert recipe['workflow']['52']['inputs']['width']==['49',0]


@pytest.mark.parametrize('options',[{'steps':51},{'steps':-1},{'steps':True},{'aspect_ratio':'100:1'},{'resolution':'8K'},{'loras':['not-approved']},{'lora_strength':float('nan')},{'loras':'../../bad.safetensors'}])
def test_unapproved_generation_options_rejected(options):
    _,tool,_=load()
    with pytest.raises(ValueError):tool._graph('robot',options=options)


def test_lora_pool_uses_only_approved_files_order_strength_and_triggers():
    recipe,_,_=load()
    recipe['options']['loras']['entries']=[{'id':'watercolor','filename':'Krea2/water.safetensors','strength':0.8,'trigger':'watercolor painting'},{'id':'detail','filename':'Krea2/detail.safetensors','strength':1.2}]
    module=types.ModuleType('pool');exec(builder.build(recipe)['content'],module.__dict__)
    tool=module.Tools()
    graph=tool._graph('robot',options={'loras':['watercolor','detail'],'lora_strength':0.5})
    assert graph['owui_lora_0']['inputs']=={'model':['73',0],'lora_name':'Krea2/water.safetensors','strength_model':0.4}
    assert graph['owui_lora_1']['inputs']['model']==['owui_lora_0',0]
    assert graph['owui_lora_1']['inputs']['strength_model']==0.6
    assert graph['53']['inputs']['model']==['owui_lora_1',0]
    assert graph['51']['inputs']['text']=='watercolor painting, robot'
    assert graph['72']==recipe['workflow']['72']
    assert 'owui_lora_0' not in tool._graph('robot')
    for selection in [['watercolor']*2,['watercolor','detail','bad'],['../../arbitrary']]:
        with pytest.raises(ValueError):tool._graph('robot',options={'loras':selection})


def test_option_bindings_fail_at_build_instead_of_import():
    recipe,_,_=load()
    recipe['options']['steps']['max']=200
    with pytest.raises(ValueError):builder.build(recipe)
    recipe['options']['steps']['max']=50
    recipe['options']['size']['node']='missing'
    with pytest.raises(ValueError):builder.build(recipe)

@pytest.mark.parametrize('seed',[0,12345,2**53-1])
def test_requested_seed_reproducible(seed):
    _,tool,_=load()
    assert tool._graph('robot',options={'seed':seed})['53']['inputs']['seed']==seed

@pytest.mark.parametrize('seed',[-2,2**53,True,1.5])
def test_invalid_seed_rejected(seed):
    _,tool,_=load()
    with pytest.raises(ValueError):tool._graph('robot',options={'seed':seed})

async def test_compact_panel_uses_height_protocol_and_escapes_messages():
    _,tool,_=load();events=[]
    async def emit(event):events.append(event)
    await tool._emit(emit,'Error <img src=x onerror=alert(1)>',25)
    panel=[e['data']['embeds'][0] for e in events if e['type']=='embeds'][0]
    assert 'iframe:height' in panel and 'height:150' in panel
    assert 'parent.postMessage' in panel and 'requestAnimationFrame' in panel
    assert '<img src=x' not in panel and '&lt;img' in panel
    assert 'fetch(' not in panel and 'src="http' not in panel
