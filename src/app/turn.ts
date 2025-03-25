import Peer from "peerjs";

export const iceServers = [
    {
        url: "turn:numb.viagenie.ca",
        credential: "muazkh",
        username: "webrtc@live.com"
    },
    {
        url: "turn:192.158.29.39:3478?transport=udp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
    },
    {
        url: "turn:192.158.29.39:3478?transport=tcp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
    },
    {
        url: "turn:turn.bistri.com:80",
        credential: "homeo",
        username: "homeo"
    },
    {
        url: "turn:turn.anyfirewall.com:443?transport=tcp",
        credential: "webrtc",
        username: "webrtc"
    },
    {
        url: "stun:stun.relay.metered.ca:80",
    },
    {
        url: "turn:global.relay.metered.ca:80",
        username: "fa1fa3f8d6645909ca69fa3a",
        credential: "hZxkqZqyhXPwtd88",
    },
    {
        url: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "fa1fa3f8d6645909ca69fa3a",
        credential: "hZxkqZqyhXPwtd88",
    },
    {
        url: "turn:global.relay.metered.ca:443",
        username: "fa1fa3f8d6645909ca69fa3a",
        credential: "hZxkqZqyhXPwtd88",
    },
    {
        url: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "fa1fa3f8d6645909ca69fa3a",
        credential: "hZxkqZqyhXPwtd88",
    },
];

export function createPeer(id: string) {
    console.log("Creating peer with id " + id);
    return new Peer(id, {
        host: "peerjs.arlojay.cc",
        secure: document.location.hostname == "localhost" ? true : undefined,
        port: 443,
        config: {
            iceServers: [
                { url: "stun:stun.l.google.com:19302" },

                ...iceServers
            ]
        }
    });
}