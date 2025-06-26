import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";

import {
  Filter
} from 'bad-words'

import type { ChatMessage, Message } from "../shared";

export class Chat extends Server<Env> {
  static options = { hibernate: true };

  messages = [] as ChatMessage[];
  filter = new Filter({ placeHolder: '❤️'});


  broadcastMessage(message: Message, exclude?: string[]) {
    this.broadcast(JSON.stringify(message), exclude);
  }

  onStart() {
    // this is where you can initialize things that need to be done before the server starts
    // for example, load previous messages from a database or a service

    // create the messages table if it doesn't exist
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
    );

    // load the messages from the database
    this.messages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages ORDER BY rowid DESC LIMIT 100`)
      .toArray().reverse() as ChatMessage[];
  }

  onConnect(connection: Connection) {
    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message),
    );
  }

  saveMessage(message: ChatMessage) {
    // check if the message already exists
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content) VALUES ('${
        message.id
      }', '${message.user}', '${message.role}', ${JSON.stringify(
        message.content,
      )}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
        message.content,
      )}`,
    );
  }

  onMessage(connection: Connection, message: WSMessage) {
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    };    
    const parsed = JSON.parse(message as string) as Message;
    const cleanMsg = {...parsed, content: escapeHtml(this.filter.clean(parsed.content))};

    // let's update our local messages store
    // const parsed = JSON.parse(message as string) as Message;
    if (cleanMsg.type === "add" || cleanMsg.type === "update") {
      this.saveMessage(cleanMsg);
      // let's broadcast the raw message to everyone else
      this.broadcast(JSON.stringify(cleanMsg));
    }
  }

  async onRequest(req: Party.Request) {
    let response;
    if (req.method === 'GET') {
      response = new Response(JSON.stringify({type: "all", messages: this.messages}), { status: 200 });
    }

    if (req.method === 'POST') {
      const parsed = await req.json() as Message;
      const cleanMsg = {...parsed, content: this.filter.clean(parsed.content)};
      this.broadcast(JSON.stringify(cleanMsg));
      if (cleanMsg.type === "add" || cleanMsg.type === "update") {
        this.saveMessage(cleanMsg);
      }
       response = new Response(JSON.stringify(cleanMsg));
    }


    // Clone the response to add CORS headers
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...response.headers,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });

    return corsResponse;
  }
}

export default {
  async fetch(request, env) {
    return (
      await routePartykitRequest(request, { ...env })
    );
  },
} satisfies ExportedHandler<Env>;
