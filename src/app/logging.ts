import { Server } from "./server/server";

export function debugLog(text: string) {
    console.log(text);

    if("server" in globalThis) {
        const server = (globalThis as any).server as Server;

        server.logDebug(text);
    } else {
        const list = document.querySelector("#debug-logs");

        const entry = document.createElement("pre");
        entry.textContent = text;

        list.appendChild(entry);
        list.scrollTop = list.scrollHeight;
    }
}