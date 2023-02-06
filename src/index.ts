import router from "./handler";
import { sycnQueue } from "./queue/syncQueue";
import { Customer, Env, RequestType } from "./types";

export default {
    async fetch(request: Request, env: Env) {
        return router.handle(request, env);
    },
    async queue(
        batch: MessageBatch<{
            method: string;
            body: any;
            customer: Customer;
        }>,
        env: Env,
        ctx: ExecutionContext
    ): Promise<void> {
        for (const message of batch.messages) {
            await sycnQueue({ ...message.body, env });
        }
    },
};
