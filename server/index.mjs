import express from "express";
import {createServer} from "http";
import {Server} from "socket.io";
import * as cors from "cors";

const app = express();
app.use(cors.default());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:8080', 'http://localhost:63342']
    }
});

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    console.log('socket handshake auth username:', username);
    if (!username) {
        return next(new Error("invalid username"));
    }
    socket.username = username;
    next();
});

io.on("connection", (socket) => {
    // fetch existing users send to connected user
    const users = [];
    for (let [id, socket] of io.of("/").sockets) {
        users.push({
            userID: id,
            username: socket.username,
        });
    }
    console.log('user lists:', users);
    socket.emit("users", users);

    // notify existing users that a new user is connected (.broadcast() send to all socket except the sender)
    console.log('new user connected:', socket.username);
    socket.broadcast.emit("user connected", {
        userID: socket.id,
        username: socket.username,
    });

    // forward the private message to the right recipient
    socket.on("private message", ({content, to}) => {
        socket.to(to).emit("private message", {
            content,
            from: socket.id,
        });
    });

    // notify users upon disconnection
    socket.on("disconnect", () => {
        socket.broadcast.emit("user disconnected", socket.id);
    });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () =>
    console.log(`server listening at http://localhost:${PORT}`)
);