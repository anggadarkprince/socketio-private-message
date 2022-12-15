import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
import * as cors from "cors";
import crypto from "crypto";
import {InMemorySessionStore} from "./sessionStore.mjs";

const app = express();
app.use(cors.default());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:8080', 'http://localhost:63342']
    }
});

const sessionStore = new InMemorySessionStore();
const randomId = () => crypto.randomBytes(8).toString("hex");

io.use((socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
        const session = sessionStore.findSession(sessionID);
        if (session) {
            socket.sessionID = sessionID;
            socket.userID = session.userID;
            socket.username = session.username;
            return next();
        }
    }

    const username = socket.handshake.auth.username;
    console.log('socket handshake auth username:', username);
    if (!username) {
        return next(new Error("invalid username"));
    }

    socket.sessionID = randomId();
    socket.userID = randomId();
    socket.username = username;
    next();
});

io.on("connection", (socket) => {
    // persist session
    sessionStore.saveSession(socket.sessionID, {
        userID: socket.userID,
        username: socket.username,
        connected: true,
    });

    // emit session details
    socket.emit("session", {
        sessionID: socket.sessionID,
        userID: socket.userID,
    });

    // join the "userID" room
    socket.join(socket.userID);

    // fetch existing users send to connected user
    const users = [];
    sessionStore.findAllSessions().forEach((session) => {
        users.push({
            userID: session.userID,
            username: session.username,
            connected: session.connected,
        });
    });
    console.log('user lists:', users);
    socket.emit("users", users);

    // notify existing users that a new user is connected (.broadcast() send to all socket except the sender)
    console.log('new user connected:', socket.username);
    socket.broadcast.emit("user connected", {
        userID: socket.userID,
        username: socket.username,
        connected: true,
    });

    // forward the private message to the right recipient (and to other tabs of the sender)
    socket.on("private message", ({content, to}) => {
        socket.to(to).to(socket.userID).emit("private message", {
            content,
            from: socket.userID,
            to,
        });
    });

    // notify users upon disconnection
    socket.on("disconnect", async () => {
        const matchingSockets = await io.in(socket.userID).allSockets();
        const isDisconnected = matchingSockets.size === 0;
        if (isDisconnected) {
            // notify other users
            socket.broadcast.emit("user disconnected", socket.userID);
            // update the connection status of the session
            sessionStore.saveSession(socket.sessionID, {
                userID: socket.userID,
                username: socket.username,
                connected: false,
            });
        }
    });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () =>
    console.log(`server listening at http://localhost:${PORT}`)
);
