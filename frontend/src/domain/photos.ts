import photos from '../data/campus-photos.json' with { type: 'json' };

export interface CampusPhoto {
  src: string;
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  originalUrl: string;
  downloadUrl: string;
  retrievedAt: string;
  sha256: string;
  changes: string;
}

export function campusPhoto(slug: string): CampusPhoto | undefined {
  return (photos as Record<string, CampusPhoto>)[slug];
}
