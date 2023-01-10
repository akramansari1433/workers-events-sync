export interface Env {
   // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
   EventsList: KVNamespace;
}

export default {
   async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext
   ): Promise<Response> {
      const getCache = (key: string) => env.EventsList.get(key);
      const setCache = (key: string, data: any) =>
         env.EventsList.put(key, data);

      const url = new URL(request.url);

      if (url.pathname === "/users" && request.method === "GET") {
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
         await setCache(
            "data",
            JSON.stringify(
               {
                  request: {
                     url,
                     ...fetchObject,
                     body: JSON.parse(fetchObject.body),
                  },
                  response: {
                     status,
                     response,
                  },
               },
               null,
               2
            )
         );
         return new Response(JSON.stringify(response, null, 2));
      } else if (url.pathname === "/events" && request.method === "GET") {
         const data = await getCache("data");
         return new Response(data);
      } else {
         return new Response("Hello World!");
      }
   },
};
