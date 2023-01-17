import router from "./handler";
import { Env } from "./types";

export default {
   async fetch(request: Request, env: Env) {
      return router.handle(request, env);
   },
};
