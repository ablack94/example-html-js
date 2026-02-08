# Learnings

## Dockerfiles should be relative to their own directory

Dockerfile `COPY` paths are always relative to the **build context**, not the
Dockerfile's location. When Dockerfiles use paths like
`COPY server-node/package.json .`, they implicitly require the build context to
be a parent directory, which couples the Dockerfile to the surrounding project
layout and breaks if the directory is renamed or moved.

**Prefer:** Each Dockerfile should treat its own directory as the build context.
Use `COPY package.json .` (not `COPY server-node/package.json .`) and build
with the server directory as context:

```bash
docker build -t my-image server-node/
```

**When sibling files are needed** (e.g. a shared `client/` directory), copy them
into the build context before building:

```bash
cp -r client/ server-node/client/
docker build -t my-image server-node/
rm -rf server-node/client/
```

This keeps each Dockerfile self-contained and portable. The build context
matches the directory the Dockerfile lives in, and all `COPY` paths make sense
when reading the Dockerfile in isolation.
