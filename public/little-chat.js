class LittleChat extends HTMLElement {
  constructor() {
    super();
    this.host = this.getAttribute('host') || 'https://likes.catskull.net'
    this.socket = null;
    this.initialized = false
  }

  render() {
    console.log('balls')
    this.innerHTML = `
      <a><span>${this.likes} Like${this.likes === 1 ? '' : 's'}</span></a>
    `
  }

  idk() {
    console.log('hi');
    this.socket = new WebSocket("ws://localhost:8787/parties/chat/j9PR9E2IDkEJdPv1t9Vja");
    this.socket.addEventListener("open", (event) => {
      console.log(event.data);
    });
    this.socket.addEventListener("message", (event) => {
      console.log(event.data);
    });
  }

  async connectedCallback() {
    this.idk();
    this.initialized = true
    const msg = {"type":"add","id":"Axwyjxnn","content":"text","user":"Eve","role":"user"}
    debugger;
    this.socket.send(JSON.stringify(msg));
  }
}

customElements.define('little-chat', LittleChat);
