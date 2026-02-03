FROM denoland/deno:2.6.8
WORKDIR /app
USER deno
COPY deno.json .
COPY deno.lock .
RUN deno install
COPY . .
RUN deno cache main.ts
CMD ["run", "-ERN", "main.ts"]
