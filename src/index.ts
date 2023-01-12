import { Router } from "itty-router";
import router from "./handler";
export interface Env {
   EventsList: KVNamespace;
   Configs: KVNamespace;
}

export default {
   async fetch(request: Request, env: Env) {
      return router.handle(request, env);
   },
};
