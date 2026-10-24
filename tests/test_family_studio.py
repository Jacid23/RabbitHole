import asyncio
import io
import json
import shutil
import time
from pathlib import Path
from unittest.mock import AsyncMock

import aiohttp
import httpx
import pytest
from PIL import Image,PngImagePlugin
from starlette.testclient import TestClient

from family_studio.app import create_app
from family_studio.auth import Session
from family_studio.config import ROOT,Settings


@pytest.fixture
def studio(tmp_path,monkeypatch):
    state={'role':'admin','calls':[]}
    original=httpx.AsyncClient.__init__
    def upstream(request):
        state['calls'].append(request)
        path=request.url.path
        token=request.headers.get('authorization','')
        owner='b' if token=='Bearer b-token' else 'a'
        if path=='/api/v1/auths/signin':
            credentials=json.loads(request.content)
            if credentials['password']!='correct':return httpx.Response(401,json={'detail':'invalid'})
            return httpx.Response(200,json={'id':'a','name':'Alex','email':'a@example.test','role':'admin','token':'a-token'})
        if path=='/api/v1/auths/':return httpx.Response(200,json={'id':owner,'name':'Alex','role':state['role'] if owner=='a' else 'user'})
        if path=='/api/models':return httpx.Response(200,json={'data':[{'id':'chat-'+owner,'name':'My assistant'}]})
        if path=='/api/v1/users/all':return httpx.Response(200,json={'users':[{'id':'a','name':'Alex','role':'admin'},{'id':'b','name':'Other','role':'user'}]})
        if path=='/api/v1/tools/':return httpx.Response(200,json=[{'id':'comfy_krea_square'}] if owner=='a' else [])
        if path=='/api/v1/tools/id/comfy_krea_square':return httpx.Response(200,json={'id':'comfy_krea_square','access_grants':[{'principal_type':'group','principal_id':'approved','permission':'read'}]})
        if path.endswith('/update'):return httpx.Response(200,json={'ok':True})
        if path=='/api/chat/completions':
            if state.get('chat_json') is not None:return httpx.Response(200,json=state['chat_json'])
            if state.get('chat_sse') is not None:return httpx.Response(200,content=state['chat_sse'],headers={'content-type':'text/event-stream'})
            return httpx.Response(200,content='data: {"choices":[{"delta":{"content":"Hello from your model."}}]}\n\ndata: [DONE]\n\n',headers={'content-type':'text/event-stream'})
        if path=='/system_stats':return httpx.Response(200,json={})
        if path=='/prompt':
            payload=json.loads(request.content);state['submitted']=payload
            return httpx.Response(200,json={'prompt_id':'own-comfy-job'})
        if path=='/history/own-comfy-job':
            payload=state['submitted']
            return httpx.Response(200,json={'own-comfy-job':{'prompt':[1,'own-comfy-job',payload['prompt'],payload['extra_data']],
                'status':{'status_str':'success'},'outputs':{'29':{'images':[{'filename':'result.png','type':'output'}]}}}})
        if path=='/view':
            buffer=io.BytesIO();meta=PngImagePlugin.PngInfo();meta.add_text('prompt',json.dumps(state['submitted']['prompt']));Image.new('RGB',(16,16),'orange').save(buffer,format='PNG',pnginfo=meta)
            state['png']=buffer.getvalue();return httpx.Response(200,content=state['png'],headers={'content-type':'image/png'})
        return httpx.Response(500,json={'error':'Unhandled test upstream route '+path})
    def init(self,*args,**kwargs):kwargs['transport']=httpx.MockTransport(upstream);original(self,*args,**kwargs)
    monkeypatch.setattr(httpx.AsyncClient,'__init__',init)
    async def no_socket(*args,**kwargs):raise aiohttp.ClientConnectionError('Test polling fallback')
    monkeypatch.setattr(aiohttp.ClientSession,'ws_connect',no_socket)
    recipes=tmp_path/'recipes';recipes.mkdir();shutil.copy2(ROOT/'tests/fixtures/comfy_krea_square.recipe.json',recipes/'comfy_krea_square.recipe.json')
    settings=Settings(data=tmp_path/'data',recipes=recipes,frontend=tmp_path/'frontend',preview=True)
    app=create_app(settings)
    app.state.auth.sessions['session-a']=Session('a-token',{'id':'a','name':'Alex','role':'admin'},time.time()+1000)
    app.state.auth.sessions['session-b']=Session('b-token',{'id':'b','name':'Other','role':'user'},time.time()+1000)
    with TestClient(app) as client:
        yield app,client,state


def login(client,owner='a'):client.cookies.set('studio_session','session-'+owner)


def test_opening_greeting_is_context_once_and_never_runs_on_entry(studio):
    app,client,state=studio;login(client)
    path=next(app.state.settings.recipes.glob('*.recipe.json'))
    recipe=json.loads(path.read_text());recipe['opening']={'greeting':'Welcome to the imaginary chocolate factory.', 'chat_starters':[{'label':'Invent a sweet','prompt':'What shall we invent?'}]}
    path.write_text(json.dumps(recipe))
    assert client.get('/api/bootstrap').json()['workflows'][0]['opening']==recipe['opening']
    assert not any(call.url.path=='/api/chat/completions' for call in state['calls'])
    reply=client.post('/api/chat',json={'model':'chat-a','workflow':recipe['id'],'message':'What shall we invent?'})
    assert reply.status_code==200
    frames=[json.loads(line[6:]) for line in reply.text.splitlines() if line.startswith('data: ')]
    ident=next(frame['id'] for frame in frames if frame['type']=='conversation')
    saved=client.get('/api/chats/'+ident).json()
    assert saved['messages'][0]=={'role':'assistant','content':recipe['opening']['greeting']}
    assert client.post('/api/chat',json={'model':'chat-a','workflow':recipe['id'],'conversation':ident,'message':'Make it sparkle.'}).status_code==200
    sent=json.loads([r for r in state['calls'] if r.url.path=='/api/chat/completions'][-1].content)
    assert sum(m['content']==recipe['opening']['greeting'] for m in sent['messages'])==1
    assert sent['messages'][-1]['content']=='Make it sparkle.'


def test_postcards_are_private_then_hole_and_rating_scoped(studio):
    app,client,state=studio
    image=io.BytesIO();Image.new('RGB',(32,32),'gold').save(image,format='PNG')
    assert client.post('/api/admin/opening-images',content=image.getvalue()).status_code==401
    login(client,'b')
    assert client.post('/api/admin/opening-images',content=image.getvalue()).status_code==403
    login(client)
    reply=client.post('/api/admin/opening-images',content=image.getvalue());assert reply.status_code==200
    ident=reply.json()['image'];assert len(ident)==32
    assert client.get('/api/admin/opening-images/'+ident).headers['content-type']=='image/webp'
    path=next(app.state.settings.recipes.glob('*.recipe.json'));recipe=json.loads(path.read_text())
    recipe['opening']={'examples':[{'image':ident,'label':'The golden room','chat':'What is behind that door?','prompt':'A golden door in an imaginary chocolate factory.'}]}
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    url=f'/api/workflows/{recipe["id"]}/examples/{ident}'
    assert client.get(url).status_code==200
    assert client.get(f'/api/workflows/{recipe["id"]}/examples/'+('f'*32)).status_code==404
    client.cookies.clear();assert client.get(url).status_code==401
    login(client,'b');assert client.get(url).status_code==403
    assert client.get('/api/admin/opening-images/'+ident).status_code==403
    monkey=AsyncMock(return_value={recipe['id']});app.state.gateway.tools=monkey
    assert client.get(url).status_code==200
    recipe.update(content_level='adult',min_age=18);path.write_text(json.dumps(recipe))
    assert client.get(url).status_code==403
    login(client);app.state.auth.sessions['session-a'].user_mode=True
    assert client.get(url).status_code==403
    assert client.post('/api/admin/opening-images',content=image.getvalue()).status_code==403


def test_postcard_upload_and_publish_validation(studio):
    app,client,state=studio;login(client)
    assert client.post('/api/admin/opening-images',content=b'<svg onload="alert(1)"></svg>').status_code==400
    assert client.post('/api/admin/opening-images',content=b'x'*(8*1024*1024+1)).status_code==413
    path=next(app.state.settings.recipes.glob('*.recipe.json'));recipe=json.loads(path.read_text())
    recipe['opening']={'examples':[{'image':'a'*32,'label':'Missing image','chat':'What is here?','prompt':'A curious room.'}]}
    assert client.post('/api/admin/workflows',json=recipe).status_code==400
    assert not (app.state.settings.recipes/(recipe['id']+'.recipe.pending')).exists()


@pytest.mark.parametrize('opening', [[], {'screen':[]}, {'greeting':17}, {'greeting':'x'*1601}, {'chat_starters':[{'label':'','prompt':'Hello'}]}, {'image_starters':[{'label':'Image','prompt':' '}]}, {'examples':[{'image':'../../x','label':'x','chat':'x','prompt':'x'}]}, {'examples':[{'image':'a'*32,'label':'x','chat':'x','prompt':'x','url':'https://external.test/image'}]}])
def test_invalid_opening_is_a_client_error(studio,opening):
    app,client,state=studio;login(client)
    recipe=json.loads(next(app.state.settings.recipes.glob('*.recipe.json')).read_text());recipe['opening']=opening
    assert client.post('/api/admin/workflows',json=recipe).status_code==400


def test_no_unauthenticated_private_api(studio):
    app,client,state=studio
    for path in ['/api/bootstrap','/api/media/unknown','/api/jobs/unknown','/api/admin/workflows']:
        assert client.get(path).status_code==401
    assert client.post('/api/generate',json={'workflow':'comfy_krea_square','prompt':'robot'}).status_code==401
    assert not state['calls']


def test_signin_cookie_is_opaque_and_token_never_returned(studio):
    app,client,_=studio
    reply=client.post('/api/auth/signin',json={'email':'a@example.test','password':'correct'})
    assert reply.status_code==200
    assert 'a-token' not in reply.text and 'correct' not in reply.text
    cookie=reply.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=strict' in cookie
    assert client.get('/api/bootstrap').status_code==200
    assert client.post('/api/auth/signout').status_code==200
    assert client.get('/api/bootstrap').status_code==401


def test_login_rate_limit_and_invalid_credentials(studio):
    _,client,_=studio
    for _ in range(5):assert client.post('/api/auth/signin',json={'email':'a@b.test','password':'wrong'}).status_code==401
    assert client.post('/api/auth/signin',json={'email':'a@b.test','password':'wrong'}).status_code==429


def test_group_scoped_models_and_workflows(studio):
    _,client,_=studio;login(client)
    first=client.get('/api/bootstrap').json()
    assert [w['id'] for w in first['workflows']]==['comfy_krea_square']
    assert [m['id'] for m in first['models']]==['chat-a']
    assert 'a-token' not in json.dumps(first) and 'unet_name' not in json.dumps(first)
    login(client,'b');second=client.get('/api/bootstrap').json()
    assert second['workflows']==[] and second['models'][0]['id']=='chat-b'
    assert client.post('/api/generate',json={'workflow':'comfy_krea_square','prompt':'robot'}).status_code==403
    assert client.post('/api/admin/workflows',json={}).status_code==403


def test_role_revocation_is_rechecked(studio):
    _,client,state=studio;login(client);state['role']='pending'
    assert client.get('/api/bootstrap').status_code==403


def test_owner_isolation_for_every_saved_kind(studio):
    app,client,_=studio;login(client,'b')
    app.state.store.put('a','chat',{'title':'private','messages':[]},'private-chat')
    app.state.store.put('a','image',{'file':'private.png','mime':'image/png'},'private-image')
    app.state.store.put('a','job',{'state':'ready','images':[]},'private-job')
    for path in ['/api/chats/private-chat','/api/media/private-image','/api/jobs/private-job']:
        assert client.get(path).status_code==404
    with pytest.raises(PermissionError):app.state.store.put('b','chat',{},'private-chat')


def test_creation_delete_and_restore_preserve_bytes_and_owner_scope(studio):
    app,client,_=studio
    store=app.state.store
    store.put('a','image',{'file':'kept.png','mime':'image/png','prompt':'Keep my metadata'},'creation')
    original=b'original image bytes with metadata'
    (store.media/'kept.png').write_bytes(original)
    assert client.post('/api/images/creation/delete',json={}).status_code==401
    assert client.get('/api/images/trash').status_code==401
    login(client,'b')
    assert client.post('/api/images/creation/delete',json={}).status_code==404
    assert client.get('/api/images/trash').json()==[]
    login(client)
    assert client.post('/api/images/creation/delete',json={},headers={'origin':'https://other.example'}).status_code==403
    assert client.post('/api/images/creation/delete',json={}).status_code==200
    assert client.get('/api/bootstrap').json()['images']==[]
    assert client.get('/api/images/trash').json()[0]['id']=='creation'
    assert client.get('/api/media/creation').content==original
    login(client,'b')
    assert client.get('/api/images/trash').json()==[]
    assert client.get('/api/media/creation').status_code==404
    assert client.post('/api/images/creation/restore',json={}).status_code==404
    login(client)
    assert client.post('/api/images/creation/restore',json={}).status_code==200
    assert client.get('/api/images/trash').json()==[]
    assert client.get('/api/bootstrap').json()['images'][0]['id']=='creation'
    assert client.get('/api/media/creation').content==original
    store.put('a','input',{'file':'kept.png','mime':'image/png'},'uploaded')
    assert client.post('/api/images/uploaded/delete',json={}).status_code==404
    assert client.post('/api/images/creation/unsupported',json={}).status_code==404


def test_cross_origin_mutations_blocked(studio):
    _,client,_=studio;login(client)
    assert client.post('/api/generate',json={},headers={'origin':'https://other.example'}).status_code==403


def test_invalid_options_never_submit(studio):
    app,client,state=studio;login(client)
    reply=client.post('/api/generate',json={'workflow':'comfy_krea_square','prompt':'robot','options':{'resolution':'8K'}})
    assert reply.status_code==400
    assert 'submitted' not in state and app.state.store.list('a','job')==[]


def test_prompt_enhancement_uses_approved_model_without_generating_or_saving_chat(studio):
    app,client,state=studio
    payload={'model':'chat-a','prompt':'a blue glass teapot'}
    assert client.post('/api/prompts/enhance',json=payload).status_code==401
    login(client,'b')
    assert client.post('/api/prompts/enhance',json=payload).status_code==403
    login(client)
    assert client.post('/api/prompts/enhance',json=payload,headers={'origin':'https://other.example'}).status_code==403
    state['chat_json']={'choices':[{'message':{'content':'A translucent blue glass teapot, soft morning light.','reasoning_content':'private reasoning'}}]}
    reply=client.post('/api/prompts/enhance',json=payload)
    assert reply.status_code==200
    assert reply.json()=={'prompt':'A translucent blue glass teapot, soft morning light.'}
    sent=json.loads(next(r for r in reversed(state['calls']) if r.url.path=='/api/chat/completions').content)
    assert sent['messages'][-1]['content']==payload['prompt']
    assert sent['tools']==[] and sent['tool_ids']==[] and sent['features']['image_generation'] is False
    assert app.state.store.list('a','chat')==[] and app.state.store.list('a','job')==[]
    assert 'submitted' not in state


@pytest.mark.parametrize('sse',[
    'data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}\n\ndata: {"choices":[{"delta":{"content":"A blue teapot."}}]}\n\ndata: [DONE]\n\n',
    'data: {"type":"response.output_text.delta","delta":"A blue teapot."}\n\ndata: {"type":"response.completed","response":{"output":[{"type":"message","content":[{"type":"output_text","text":"A blue teapot."}]}]}}\n\n',
])
def test_prompt_enhancement_accepts_streaming_providers(studio,sse):
    _,client,state=studio;login(client);state['chat_sse']=sse
    reply=client.post('/api/prompts/enhance',json={'model':'chat-a','prompt':'teapot'})
    assert reply.status_code==200 and reply.json()=={'prompt':'A blue teapot.'}


def test_prompt_enhancement_rejects_empty_and_unusable_answers(studio):
    _,client,state=studio;login(client)
    assert client.post('/api/prompts/enhance',json={'model':'chat-a','prompt':'  '}).status_code==400
    state['chat_json']={'choices':[{'message':{'content':'','reasoning_content':'only reasoning'}}]}
    assert client.post('/api/prompts/enhance',json={'model':'chat-a','prompt':'teapot'}).status_code==502
    state['chat_json']={'choices':[{'message':{'content':'<think>hidden</think>A blue teapot.'}}]}
    assert client.post('/api/prompts/enhance',json={'model':'chat-a','prompt':'teapot'}).json()=={'prompt':'A blue teapot.'}


def test_real_job_flow_with_mocked_servers_preserves_metadata_and_ownership(studio):
    app,client,state=studio;login(client)
    reply=client.post('/api/generate',json={'workflow':'comfy_krea_square','prompt':'robot','options':{'aspect_ratio':'16:9','resolution':'2K','steps':12,'seed':12345}})
    assert reply.status_code==202;ident=reply.json()['id']
    for _ in range(100):
        job=client.get('/api/jobs/'+ident).json()
        if job['state'] not in {'running','queued'}:break
        time.sleep(.02)
    assert job['state']=='ready',job
    file_id=job['images'][0]
    image=client.get('/api/media/'+file_id)
    assert image.content==state['png']
    png=Image.open(io.BytesIO(image.content));graph=json.loads(png.info['prompt'])
    assert graph['52']['inputs']['width']==2048 and graph['53']['inputs']['seed']==12345
    assert len([r for r in state['calls'] if r.url.path=='/prompt'])==1
    login(client,'b');assert client.get('/api/media/'+file_id).status_code==404


def test_chat_stream_and_history_are_account_scoped(studio):
    app,client,state=studio;login(client)
    reply=client.post('/api/chat',json={'model':'chat-a','message':'Hello'})
    assert reply.status_code==200 and 'Hello from your model.' in reply.text
    payload=json.loads(next(r for r in state['calls'] if r.url.path=='/api/chat/completions').content)
    assert payload['tools']==[] and payload['tool_ids']==[]
    conversation=app.state.store.list('a','chat')[0]
    assert conversation['messages'][-1]['content']=='Hello from your model.'
    login(client,'b');assert client.get('/api/chats/'+conversation['id']).status_code==404
    assert client.post('/api/chat',json={'model':'chat-a','message':'Hello'}).status_code==403


def test_admin_publish_preserves_grants_and_backs_up_recipe(studio):
    app,client,state=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()));recipe['options']['steps']['max']=40
    reply=client.post('/api/admin/workflows',json=recipe)
    assert reply.status_code==200
    update=next(r for r in state['calls'] if r.url.path.endswith('/update'))
    assert json.loads(update.content)['access_grants']==[{'principal_type':'group','principal_id':'approved','permission':'read'}]
    assert app.state.catalog.recipes()['comfy_krea_square']['options']['steps']['max']==40
    assert list((app.state.settings.data/'recipe-backups').glob('*.json'))


def test_saved_enhancer_model_is_persisted_and_used_instead_of_client_model(studio):
    app,client,state=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()))
    recipe['enhancer_model']='chat-a'
    assert client.get('/api/admin/workflows').json()['models']==[{'id':'chat-a','name':'My assistant'}]
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    assert app.state.catalog.recipes()[recipe['id']]['enhancer_model']=='chat-a'
    assert client.get('/api/bootstrap').json()['workflows'][0]['enhancer_model']=='chat-a'
    state['chat_json']={'choices':[{'message':{'content':'A detailed blue teapot.'}}]}
    reply=client.post('/api/prompts/enhance',json={'workflow':recipe['id'],'model':'not-approved','prompt':'a teapot'})
    assert reply.status_code==200
    request=next(r for r in reversed(state['calls']) if r.url.path=='/api/chat/completions')
    assert json.loads(request.content)['model']=='chat-a'
    recipe['enhancer_model']='forbidden-model'
    assert client.post('/api/admin/workflows',json=recipe).status_code==403
    assert app.state.catalog.recipes()[recipe['id']]['enhancer_model']=='chat-a'
    login(client,'b')
    assert client.post('/api/prompts/enhance',json={'workflow':recipe['id'],'model':'chat-b','prompt':'a teapot'}).status_code==403


def test_workflow_enhancement_requires_member_model_access_and_preserves_legacy_default(studio):
    app,client,state=studio;login(client)
    state['chat_json']={'choices':[{'message':{'content':'A detailed blue teapot.'}}]}
    payload={'workflow':'comfy_krea_square','model':'chat-a','prompt':'a teapot'}
    assert client.post('/api/prompts/enhance',json=payload).status_code==200
    path=next(app.state.settings.recipes.glob('*.recipe.json'))
    recipe=json.loads(path.read_text());recipe['enhancer_model']='model-no-longer-approved'
    path.write_text(json.dumps(recipe))
    assert client.post('/api/prompts/enhance',json=payload).status_code==403
    recipe['enhancer_model']=['invalid']
    assert client.post('/api/admin/workflows',json=recipe).status_code==400


def test_hole_prompts_and_models_are_resolved_by_server(studio):
    app,client,state=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()))
    recipe.update(chat_model='chat-a',chat_prompt='Teach patiently with concrete examples.',enhancer_prompt='Use a whimsical watercolor style.')
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    payload={'workflow':recipe['id'],'model':'client-cannot-change-this','message':'Explain rain.'}
    assert client.post('/api/chat',json=payload).status_code==200
    request=next(r for r in reversed(state['calls']) if r.url.path=='/api/chat/completions')
    sent=json.loads(request.content)
    assert sent['model']=='chat-a'
    assert sent['messages'][0]['role']=='system' and sent['messages'][0]['content'].startswith(recipe['chat_prompt'])
    assert 'Audience guidance' in sent['messages'][0]['content']
    saved=app.state.store.list('a','chat')[0]
    assert saved['workflow']==recipe['id']
    assert all(message['role']!='system' for message in saved['messages'])
    state['chat_json']={'choices':[{'message':{'content':'A watercolor illustration of rain.'}}]}
    assert client.post('/api/prompts/enhance',json={'workflow':recipe['id'],'model':'client-cannot-change-this','prompt':'rain'}).status_code==200
    request=next(r for r in reversed(state['calls']) if r.url.path=='/api/chat/completions')
    sent=json.loads(request.content)
    assert sent['model']=='chat-a' and sent['messages'][0]['content'].startswith(recipe['enhancer_prompt'])
    public=client.get('/api/bootstrap').json()
    assert recipe['chat_prompt'] not in json.dumps(public) and recipe['enhancer_prompt'] not in json.dumps(public)
    assert public['chats'][0]['workflow']==recipe['id']


def test_fixed_hole_loras_cannot_be_changed_by_runtime_requests(studio):
    app,client,state=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()))
    recipe['options']['loras']['entries']=[{'id':'storybook','filename':'storybook.safetensors','strength':0.65,'trigger':'storybook'}]
    recipe['default_loras']=['storybook']
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    payload={'workflow':recipe['id'],'prompt':'a rabbit','options':{'loras':['storybook']}}
    assert client.post('/api/generate',json=payload).status_code==403
    payload['options']={'lora_strength':0.5}
    assert client.post('/api/generate',json=payload).status_code==403
    payload['options']={}
    reply=client.post('/api/generate',json=payload)
    assert reply.status_code==202
    for _ in range(100):
        job=client.get('/api/jobs/'+reply.json()['id']).json()
        if job['state'] not in {'running','queued'}:break
        time.sleep(.02)
    assert job['state']=='ready',job
    graph=state['submitted']['prompt']
    assert graph['owui_lora_0']['inputs']['lora_name']=='storybook.safetensors'
    assert graph['owui_lora_0']['inputs']['strength_model']==0.65
    assert job['options']['loras']==['storybook']


def test_profiles_are_admin_managed_and_only_own_profile_is_returned(studio):
    _,client,_=studio;login(client,'b')
    assert client.get('/api/admin/profiles').status_code==403
    assert client.post('/api/admin/profiles/b',json={'name':'Forged','content_level':'adult'}).status_code==403
    login(client)
    assert len(client.get('/api/admin/profiles').json()['users'])==2
    profile={'name':'Nova','sex':'female','age':11,'content_level':'general','instructions':'Explain ideas in short, friendly sentences.'}
    assert client.post('/api/admin/profiles/b',json=profile).status_code==200
    assert client.post('/api/admin/profiles/unknown',json=profile).status_code==404
    assert client.post('/api/admin/profiles/b',json={**profile,'age':-1}).status_code==400
    assert client.post('/api/admin/profiles/b',json=profile,headers={'origin':'https://other.example'}).status_code==403
    assert 'Nova' not in json.dumps(client.get('/api/bootstrap').json())
    login(client,'b')
    assert client.get('/api/bootstrap').json()['profile']['name']=='Nova'
    state_response=client.post('/api/chat',json={'model':'chat-b','message':'Hello'})
    assert state_response.status_code==200


def test_user_mode_revokes_admin_endpoints_and_applies_age_and_rating_access(studio):
    app,client,_=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()));recipe.update(content_level='adult',min_age=18)
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    assert client.post('/api/admin/profiles/a',json={'name':'Alex','age':16,'content_level':'adult'}).status_code==200
    assert client.post('/api/auth/view',json={'user_mode':True}).status_code==200
    result=client.get('/api/bootstrap').json()
    assert result['user']['role']=='user' and result['user']['is_admin'] is True
    assert result['workflows']==[]
    for path in ['/api/admin/workflows','/api/admin/profiles','/api/admin/builder']:
        assert client.get(path).status_code==403
    assert client.post('/api/generate',json={'workflow':recipe['id'],'prompt':'hello'}).status_code==403
    assert client.post('/api/auth/view',json={'user_mode':False}).status_code==200
    assert client.get('/api/admin/workflows').status_code==200
    assert client.post('/api/admin/profiles/a',json={'name':'Alex','age':22,'content_level':'adult'}).status_code==200
    assert client.post('/api/auth/view',json={'user_mode':True}).status_code==200
    assert client.get('/api/bootstrap').json()['workflows'][0]['id']==recipe['id']
    login(client,'b')
    assert client.post('/api/auth/view',json={'user_mode':False}).status_code==403


def test_profile_context_and_world_style_reach_correct_targets(studio):
    app,client,state=studio;login(client)
    assert client.post('/api/admin/profiles/a',json={'name':'Orion','sex':'male','age':21,'content_level':'adult','instructions':'Address me as Captain.'}).status_code==200
    recipe=next(iter(app.state.catalog.recipes().values()));recipe.update(theme='cartoon',image_prompt='Bold cartoon illustration, no photorealism.',chat_prompt='Act as a cartoon guide.')
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    assert client.post('/api/chat',json={'model':'chat-a','workflow':recipe['id'],'message':'Hello'}).status_code==200
    sent=json.loads(next(r for r in reversed(state['calls']) if r.url.path=='/api/chat/completions').content)
    assert all(value in sent['messages'][0]['content'] for value in ['Orion','male','21','Captain','cartoon guide'])
    reply=client.post('/api/generate',json={'workflow':recipe['id'],'prompt':'a rabbit'})
    for _ in range(100):
        job=client.get('/api/jobs/'+reply.json()['id']).json()
        if job['state'] not in {'running','queued'}:break
        time.sleep(.02)
    assert job['state']=='ready',job
    graph=json.dumps(state['submitted']['prompt'])
    assert 'Bold cartoon illustration' in graph
    assert all(value not in graph for value in ['Orion','Captain','sex_or_gender'])


def test_preview_reveals_no_private_catalog(studio):
    _,client,_=studio
    reply=client.get('/api/preview');assert reply.status_code==200
    assert 'comfy_krea_square' not in reply.text
    assert 'unet_name' not in reply.text
    assert reply.json()['workflows'][0]['loras']==[]
    assert client.get('/api/preview/not-a-preview-file').status_code==404


def test_invalid_admin_recipe_is_a_client_error_without_publication(studio):
    _,client,state=studio;login(client)
    assert client.post('/api/admin/workflows',json={'id':'../escape'}).status_code==400
    assert not any(r.method=='POST' and r.url.path.endswith(('/update','/create')) for r in state['calls'])


def test_nonstreaming_provider_reply_is_displayed_and_saved(studio):
    app,client,state=studio;login(client)
    state['chat_json']={'choices':[{'message':{'content':[{'type':'text','text':'A complete answer.'}]}}]}
    reply=client.post('/api/chat',json={'model':'chat-a','message':'Hello'})
    assert 'A complete answer.' in reply.text
    assert app.state.store.list('a','chat')[0]['messages'][-1]['content']=='A complete answer.'


def test_empty_json_provider_reply_is_an_explicit_error(studio):
    _,client,state=studio;login(client)
    state['chat_json']={'choices':[]}
    reply=client.post('/api/chat',json={'model':'chat-a','message':'Hello'})
    assert '"type": "error"' in reply.text and 'returned no answer' in reply.text


def test_responses_api_stream_displays_answer_without_reasoning_or_duplicates(studio):
    app,client,state=studio;login(client)
    frames=[{'type':'response.reasoning_summary_text.delta','delta':'Private thinking'},
            {'type':'response.output_text.delta','delta':'Hello '},
            {'type':'response.output_text.delta','delta':'family!'},
            {'type':'response.output_text.done','text':'Hello family!'},
            {'type':'response.completed','response':{'output':[{'type':'message','content':[{'type':'output_text','text':'Hello family!'}]}]}}]
    state['chat_sse']=''.join('data: '+json.dumps(frame)+'\n\n' for frame in frames)+'data: [DONE]\n\n'
    reply=client.post('/api/chat',json={'model':'chat-a','message':'Hello'})
    assert 'Private thinking' not in reply.text and '"type": "error"' not in reply.text
    assert app.state.store.list('a','chat')[0]['messages'][-1]['content']=='Hello family!'


def test_rating_change_hides_saved_history_and_blocks_direct_media(studio):
    app,client,_=studio;login(client)
    recipe=next(iter(app.state.catalog.recipes().values()));recipe.update(content_level='adult')
    assert client.post('/api/admin/workflows',json=recipe).status_code==200
    image=app.state.store.put('a','image',{'workflow':recipe['id'],'file':'private.png','mime':'image/png'})
    chat=app.state.store.put('a','chat',{'workflow':recipe['id'],'title':'Private','model':'chat-a','messages':[]})
    job=app.state.store.put('a','job',{'workflow':recipe['id'],'state':'ready'})
    assert client.post('/api/auth/view',json={'user_mode':True}).status_code==200
    result=client.get('/api/bootstrap').json()
    assert result['images']==result['chats']==result['jobs']==[]
    for path in ['/api/media/'+image['id'], '/api/chats/'+chat['id'], '/api/jobs/'+job['id']]:
        assert client.get(path).status_code==403
    assert client.post('/api/images/'+image['id']+'/delete').status_code==403
    assert client.post('/api/auth/view',json={'user_mode':False}).status_code==200
    assert client.get('/api/chats/'+chat['id']).status_code==200


def test_profile_persists_in_reopened_store(studio):
    from family_studio.store import Store
    from family_studio.profiles import Profiles
    app,client,_=studio;login(client)
    profile={'name':'Nova','age':12,'sex':'','content_level':'general','instructions':'Use simple explanations.'}
    assert client.post('/api/admin/profiles/b',json=profile).status_code==200
    store=Store(app.state.settings.data)
    try:
        assert Profiles(store).get({'id':'b','name':'Other'})==profile
    finally:
        store.close()

def test_temporary_chat_keeps_context_without_persisting(studio):
    app,client,state=studio;login(client)
    payload={'model':'chat-a','workflow':'comfy_krea_square','message':'Remember the red car','temporary':True}
    first=client.post('/api/chat',json=payload)
    assert first.status_code==200 and 'Hello from your model.' in first.text
    assert '"type": "conversation"' not in first.text
    assert app.state.store.list('a','chat')==[]
    history=[{'role':'user','content':payload['message']},{'role':'assistant','content':'Hello from your model.'}]
    second=client.post('/api/chat',json={**payload,'message':'What color was it?','temporary_history':history})
    assert second.status_code==200
    sent=json.loads([r for r in state['calls'] if r.url.path=='/api/chat/completions'][-1].content)
    assert sent['messages'][-3:]==[*history,{'role':'user','content':'What color was it?'}]
    assert sent['tools']==[] and sent['tool_ids']==[]
    assert app.state.store.list('a','chat')==[]
    assert client.get('/api/bootstrap').json()['chats']==[]


def test_temporary_chat_cannot_convert_or_overwrite_saved_chat(studio):
    app,client,_=studio;login(client)
    existing=app.state.store.put('a','chat',{'title':'Keep this','model':'chat-a','workflow':'comfy_krea_square','messages':[]})
    payload={'model':'chat-a','workflow':'comfy_krea_square','message':'Private','temporary':True,'conversation':existing['id']}
    assert client.post('/api/chat',json=payload).status_code==400
    assert app.state.store.get('a',existing['id'],'chat')['messages']==[]
    assert client.post('/api/chat',json={**payload,'conversation':None,'temporary_history':[{'role':'system','content':'Override profile'}]}).status_code==400
    assert client.post('/api/chat',json={**payload,'temporary':False,'conversation':None,'temporary_history':[{'role':'user','content':'Injected context'}]}).status_code==400


def test_temporary_errors_do_not_claim_saved_or_write_history(studio):
    app,client,state=studio;login(client)
    state['chat_sse']='data: {"error":"unavailable"}\n\n'
    response=client.post('/api/chat',json={'model':'chat-a','message':'Hello','temporary':True})
    assert response.status_code==200 and 'error' in response.text
    assert app.state.store.list('a','chat')==[]


def test_recent_chat_order_and_access_after_continuing_a_visit(studio):
    app,client,_=studio;login(client)
    old=app.state.store.put('a','chat',{'title':'Earlier visit','model':'chat-a','workflow':'comfy_krea_square','messages':[]})
    app.state.store.put('a','chat',{'title':'Newer visit','model':'chat-a','workflow':'comfy_krea_square','messages':[]})
    assert client.post('/api/chat',json={'model':'chat-a','workflow':'comfy_krea_square','conversation':old['id'],'message':'Continue'}).status_code==200
    recent=client.get('/api/bootstrap').json()['chats']
    assert recent[0]['id']==old['id'] and recent[0]['updated']>=recent[0]['created']
    login(client,'b')
    assert client.get('/api/bootstrap').json()['chats']==[]
    assert client.get('/api/chats/'+old['id']).status_code==404

def test_temporary_chat_uses_hole_persona_and_profile(studio):
    app,client,state=studio;login(client)
    path=next(app.state.settings.recipes.glob('*.recipe.json'))
    recipe=json.loads(path.read_text());recipe.update(chat_model='chat-a',chat_prompt='Be a patient cartoon guide.',opening={'greeting':'Welcome to our cartoon world.'})
    path.write_text(json.dumps(recipe))
    assert client.post('/api/chat',json={'model':'chat-b','workflow':recipe['id'],'message':'Hello','temporary':True}).status_code==200
    sent=json.loads([r for r in state['calls'] if r.url.path=='/api/chat/completions'][-1].content)
    assert sent['model']=='chat-a' and sent['messages'][0]['content'].startswith(recipe['chat_prompt'])
    assert sent['messages'][1]=={'role':'assistant','content':recipe['opening']['greeting']}
    assert app.state.store.list('a','chat')==[]

def test_chat_lock_prevents_delete_and_survives_continuing(studio):
    app,client,_=studio;login(client)
    chat=app.state.store.put('a','chat',{'title':'Keep this visit','model':'chat-a','workflow':'comfy_krea_square','messages':[]})
    url='/api/chats/'+chat['id']
    assert client.post(url+'/lock',json={}).status_code==200
    assert client.get('/api/bootstrap').json()['chats'][0]['locked'] is True
    assert client.post(url+'/trash',json={}).status_code==409
    assert client.post('/api/chat',json={'model':'chat-a','workflow':'comfy_krea_square','conversation':chat['id'],'message':'Continue our visit'}).status_code==200
    assert app.state.store.get('a',chat['id'],'chat')['locked'] is True
    assert client.post(url+'/unlock',json={}).status_code==200
    assert client.post(url+'/trash',json={}).status_code==200
    assert client.get(url).status_code==404
    bootstrap=client.get('/api/bootstrap').json()
    assert bootstrap['chats']==[] and bootstrap['trashed_chats'][0]['id']==chat['id']
    assert client.post(url+'/restore',json={}).status_code==200
    restored=client.get(url).json()
    assert restored['messages'][-1]['content']=='Hello from your model.'
    assert restored['created']==chat['created'] and restored['locked'] is False
    assert client.get('/api/bootstrap').json()['trashed_chats']==[]


def test_chat_management_respects_owner_and_hole_access(studio):
    app,client,_=studio
    chat=app.state.store.put('a','chat',{'title':'Private','model':'chat-a','workflow':'comfy_krea_square','messages':[]})
    url='/api/chats/'+chat['id']
    login(client,'b')
    for action in ['lock','unlock','trash','restore']:
        assert client.post(url+'/'+action,json={}).status_code==404
    login(client)
    assert client.post(url+'/trash',json={}).status_code==200
    login(client,'b');assert client.get('/api/bootstrap').json()['trashed_chats']==[]
    login(client);app.state.catalog.visible=AsyncMock(return_value={})
    assert client.get('/api/bootstrap').json()['trashed_chats']==[]
    assert client.post(url+'/restore',json={}).status_code==403


def test_new_lock_survives_stale_stream_write(studio):
    app,client,_=studio;login(client)
    chat=app.state.store.put('a','chat',{'title':'Streaming','model':'chat-a','messages':[]})
    assert app.state.store.manage_chat('a',chat['id'],'lock')
    app.state.store.put('a','chat',{**chat,'messages':[{'role':'assistant','content':'Finished'}]},chat['id'])
    assert app.state.store.get('a',chat['id'],'chat')['locked'] is True


def test_chat_cannot_be_deleted_during_a_reply(studio):
    app,client,_=studio;login(client)
    chat=app.state.store.put('a','chat',{'title':'Active','model':'chat-a','messages':[]})
    from family_studio.chat import Chat
    # Exercise the route's live Chat instance without timing-dependent model streams.
    route=next(r for r in app.routes if getattr(r,'path','')=='/api/chats/{id}/{action}')
    service=next(c.cell_contents for c in route.endpoint.__closure__ if isinstance(c.cell_contents,Chat))
    service.active.add('a')
    assert client.post('/api/chats/'+chat['id']+'/trash',json={}).status_code==409
    assert app.state.store.get('a',chat['id'],'chat') is not None
    service.active.clear()

def trashed_chat(app, owner='a', workflow='comfy_krea_square'):
    row=app.state.store.put(owner,'chat',{'title':'Discarded visit','model':'chat-a','workflow':workflow,'messages':[{'role':'user','content':'Remember this'}]})
    assert app.state.store.manage_chat(owner,row['id'],'trash')
    return row


def test_permanent_chat_delete_requires_confirmation_and_trash(studio):
    app,client,_=studio;login(client);row=trashed_chat(app)
    endpoint='/api/chats/trash/purge'
    for body in [{'ids':[row['id']]},{'ids':[row['id']],'confirmed':False},{'ids':[],'confirmed':True}]:
        assert client.post(endpoint,json=body).status_code==400
        assert app.state.store.get('a',row['id'],'trashed_chat')
    assert client.post(endpoint,json={'ids':[row['id'],row['id']],'confirmed':True}).json()=={'deleted':1}
    assert app.state.store.get('a',row['id']) is None
    assert client.post('/api/chats/'+row['id']+'/restore',json={}).status_code==404
    assert client.get('/api/bootstrap').json()['trashed_chats']==[]


def test_bulk_chat_purge_is_owner_scoped_and_all_or_nothing(studio):
    app,client,_=studio;login(client)
    own=trashed_chat(app);other=trashed_chat(app,owner='b')
    saved=app.state.store.put('a','chat',{'title':'Saved','model':'chat-a','messages':[]})
    for invalid in [other['id'],saved['id'],'missing']:
        response=client.post('/api/chats/trash/purge',json={'ids':[own['id'],invalid],'confirmed':True})
        assert response.status_code==404
        assert app.state.store.get('a',own['id'],'trashed_chat')
    assert app.state.store.get('b',other['id'],'trashed_chat')
    assert app.state.store.get('a',saved['id'],'chat')


def test_purge_checks_current_hole_permissions_and_exact_selection(studio):
    app,client,_=studio;login(client)
    selected=trashed_chat(app);kept=trashed_chat(app)
    app.state.store.put('a','image',{'file':'keep.png'},'keep-image')
    assert client.post('/api/chats/trash/purge',json={'ids':[selected['id']],'confirmed':True}).json()=={'deleted':1}
    assert app.state.store.get('a',kept['id'],'trashed_chat')
    assert app.state.store.get('a','keep-image','image')
    app.state.catalog.visible=AsyncMock(return_value={})
    assert client.post('/api/chats/trash/purge',json={'ids':[kept['id']],'confirmed':True}).status_code==403
    assert app.state.store.get('a',kept['id'],'trashed_chat')


def test_purge_does_not_delete_a_concurrently_restored_or_locked_chat(studio):
    app,_,_=studio
    first=trashed_chat(app);restored=trashed_chat(app)
    app.state.store.manage_chat('a',restored['id'],'restore')
    with pytest.raises(ValueError):app.state.store.purge_chats('a',[first['id'],restored['id']])
    assert app.state.store.get('a',first['id'],'trashed_chat')
    assert app.state.store.get('a',restored['id'],'chat')
    locked=app.state.store.put('a','trashed_chat',{'title':'Protected legacy record','locked':True})
    with pytest.raises(ValueError):app.state.store.purge_chats('a',[first['id'],locked['id']])
    assert app.state.store.get('a',first['id'],'trashed_chat')


def test_empty_trash_lists_and_removes_more_than_history_preview_limit(studio):
    app,client,_=studio;login(client)
    for i in range(205):app.state.store.put('a','trashed_chat',{'title':str(i),'model':'chat-a','messages':[]})
    rows=client.get('/api/bootstrap').json()['trashed_chats']
    assert len(rows)==205
    assert client.post('/api/chats/trash/purge',json={'ids':[r['id'] for r in rows],'confirmed':True}).json()=={'deleted':205}
    assert app.state.store.list('a','trashed_chat',limit=None)==[]
