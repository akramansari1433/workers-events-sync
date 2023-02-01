import router from "./handler";
import { bulkRequestResend } from "./socket/bulkRequestResend";
import { Env } from "./types";

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);
        if (url.pathname == "/ws/request/resendbulk") {
            return bulkRequestResend(env);
        }
        return router.handle(request, env);
    },
};
