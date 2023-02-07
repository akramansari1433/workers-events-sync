import router from "./handler";
import { resendBulkRequestsQueue } from "./queue/resendBulkRequests";
import { sycnQueue } from "./queue/syncQueue";
import { Customer, Env, EventType } from "./types";

export default {
    async fetch(request: Request, env: Env) {
        return router.handle(request, env);
    },
    async queue(
        batch: MessageBatch<{
            method?: string;
            body?: any;
            customer?: Customer;
            event?: EventType;
            url: string;
        }>,
        env: Env
    ): Promise<void> {
        for (const message of batch.messages) {
            switch (message.body.url) {
                case "/api/sync":
                    return await sycnQueue({
                        method: message.body.method!,
                        customer: message.body.customer!,
                        body: message.body.body,
                        env,
                    });
                case "/request/resendbulk":
                    return await resendBulkRequestsQueue({
                        event: message.body.event!,
                        customer: message.body.customer!,
                        body: message.body.body,
                        env,
                    });
                default:
                    console.log("Something went wrong!");
            }
        }
    },
};
