/**
 * Header photos of the public pages, served by the Unsplash CDN in several
 * widths (srcset), so phones download ~640 px and large screens up to
 * 2560 px instead of one low-resolution file for everyone.
 *
 * All photos are free to use under the Unsplash License
 * (https://unsplash.com/license): https://images.unsplash.com/<id>
 */
export type HeroKey = "home" | "volunteering" | "info" | "about" | "legal";

interface HeroPhoto {
  id: string;
  /** CSS object-position: keeps the subject visible when the photo is cropped */
  position: string;
}

const PHOTOS: Record<HeroKey, HeroPhoto> = {
  // Volunteers in blue shirts cleaning up a forest
  home: { id: "photo-1758599668408-dfb4a7ed22c0", position: "center 45%" },
  // Volunteers planting along a river bank
  volunteering: { id: "photo-1652971876875-05db98fab376", position: "center 60%" },
  // Two volunteers tending a community garden
  info: { id: "photo-1788538812809-f22af3a6993a", position: "center 55%" },
  // Group of friends arm in arm at sunset
  about: { id: "photo-1511632765486-a01980e01a18", position: "center 40%" },
  // Cliffs and sea on the coast of Gran Canaria
  legal: { id: "photo-1670605112443-cb9a38a2ed61", position: "center 50%" },
};

const WIDTHS = [640, 960, 1280, 1920, 2560];

const url = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=75`;

/** Props for an <img> that fills the header (object-cover) */
export function heroImageProps(key: HeroKey) {
  const photo = PHOTOS[key];
  return {
    src: url(photo.id, 1920),
    srcSet: WIDTHS.map((w) => `${url(photo.id, w)} ${w}w`).join(", "),
    sizes: "100vw",
    style: { objectPosition: photo.position },
  };
}
