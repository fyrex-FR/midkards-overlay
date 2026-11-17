export class EventHub {
  /* build : empreinte du code servi (voir build.js), envoyee a chaque
     connexion. Apres un deploiement, le flux se reconnecte sur le nouveau
     serveur et la page voit l'empreinte changer. */
  constructor(build = null) {
    this.build = build;
    this.clients = new Set();
    this.heartbeat = setInterval(() => {
      for (const response of this.clients) response.write(': keepalive\n\n');
    }, 20_000);
    this.heartbeat.unref();
  }

  add(request, response, state) {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write('retry: 3000\n\n');
    if (this.build) response.write(`event: build\ndata: ${JSON.stringify(this.build)}\n\n`);
    if (state) {
      response.write(`event: config\ndata: ${JSON.stringify({
        config: state.config,
        version: Number(state.version),
        sections: [],
      })}\n\n`);
    }
    this.clients.add(response);
    request.on('close', () => this.clients.delete(response));
  }

  publish(state, sections) {
    const payload = JSON.stringify({
      config: state.config,
      version: Number(state.version),
      sections,
    });
    for (const response of this.clients) {
      response.write(`event: config\ndata: ${payload}\n\n`);
    }
  }
}
