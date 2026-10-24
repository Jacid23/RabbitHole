import { Gallery } from "./Gallery";
import { Icon } from "./Icons";
import type { ImageItem } from "./types";

export function LibraryView({ images, onChanged, onCreate }: {
  images: ImageItem[]; onChanged: () => void; onCreate: (prompt: string, workflow?: string) => void;
}) {
  return (
                <section className="library-page">
                  <div className="view-top">
                    <div className="breadcrumb">
                      Your space <span>/</span> My library
                    </div>
                    <span className="page-tag">
                      <Icon name="lock" size={12} />
                      YOUR PERSONAL COLLECTION
                    </span>
                  </div>
                  <div className="library-heading">
                    <p className="eyebrow">CURIOSITIES WORTH KEEPING</p>
                    <h1>
                      Your cabinet <em>of curiosities.</em>
                    </h1>
                    <p>The wonderful things you found along the way.</p>
                  </div>
                  <div
                    className="library-results panel-scroll"
                    role="region"
                    aria-label="Image library"
                    tabIndex={0}
                  >
                    <Gallery
                      images={images}
                      preview={false}
                      onChanged={onChanged}
                      onReuse={(image) => onCreate(image.prompt, image.workflow)}
                    />
                  </div>
                </section>
  );
}
