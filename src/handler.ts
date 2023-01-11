import { Router } from "itty-router";

export const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Methods": "GET, PUT, POST,DELETE",
   "Access-Control-Max-Age": "86400",
   "Content-Type": "application/json",
};

const router = Router();

router.get("/users", async (request, env) => {
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
   await env.EventsList.put(
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

router.get("/events", async (request, env) => {
   const keys: any[] = (await env.EventsList.list()).keys;
   const values: any[] = await Promise.all(
      keys.map(async (key) => await env.EventsList.get(key.name))
   );

   const data = values.map((value) => JSON.parse(value));

   return new Response(JSON.stringify(data, null, 2), {
      headers: { ...corsHeaders },
   });
});

router.get("/events/:id", async (request, env) => {
   const { id } = request.params;
   const data = await env.EventsList.get(id);
   return new Response(data ? data : JSON.stringify({}), {
      headers: { ...corsHeaders },
   });
});

router.all(
   "*",
   () =>
      new Response("Not Found.", {
         status: 404,
         headers: { ...corsHeaders },
      })
);

export default router;
