import { Freebuild } from "./freebuild";
import { Server } from "../../server";

export function init(server: Server) {
    server.addPlugin(new Freebuild());
}