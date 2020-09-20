export default class UrlParam {
  data: string | null;
  dataUrl: string | null;
  embeddedId: string | null;
  title: string;

  constructor() {
    const url = new URL(window.location.href);
    this.dataUrl = url.searchParams.get('dataUrl');
    this.data = url.searchParams.get('data');
    this.embeddedId = url.searchParams.get('embeddedId');
    this.title = url.searchParams.get('title') || 'Treedoc Viewer';
  }
}
