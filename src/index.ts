import { Router } from "itty-router";
export interface Env {
   EventsList: KVNamespace;
}

export const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
   "Access-Control-Max-Age": "86400",
   "Content-Type": "application/json",
};

export default {
   async fetch(request: Request, env: Env) {
      const router = Router();
      const getCache = (key: string) => env.EventsList.get(key);
      const setCache = (key: string, data: any) =>
         env.EventsList.put(key, data);

      router.get("/users", async () => {
         let status;
         const query = `query getUser{
			users{
			  id
			  name
			  email
			  created_at
			}
		  }`;
         const url = "https://major-honeybee-52.hasura.app/v1/graphql";
         const fetchObject = {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({
               query,
            }),
         };
         const response = await fetch(url, fetchObject).then((response) => {
            status = response.status;
            return response.json();
         });

         const data = await response;

         let key = Math.floor(Math.random() * 100 + 1);
         await setCache(
            "ID" + key,
            JSON.stringify({
               key: "ID" + key,
               request: {
                  url,
                  ...fetchObject,
                  body: JSON.parse(fetchObject.body),
               },
               response: {
                  status,
                  response: data,
               },
            })
         );
         return new Response(JSON.stringify(data, null, 2), {
            headers: { ...corsHeaders },
         });
      });

      router.get("/events", async () => {
         const keys = (await env.EventsList.list()).keys;
         const values: any[] = await Promise.all(
            keys.map(async (key) => await getCache(key.name))
         );

         const data = values.map((value) => JSON.parse(value));

         return new Response(JSON.stringify(data, null, 2), {
            headers: { ...corsHeaders },
         });
      });

      router.get("/events/:id", async ({ params }) => {
         const { id } = params;
         const data = await getCache(id);
         return new Response(data ? data : JSON.stringify({}), {
            headers: { ...corsHeaders },
         });
      });

      router.all(
         "*",
         () =>
            new Response("Not Found.", {
               status: 404,
            })
      );

      return router.handle(request);
   },
};
