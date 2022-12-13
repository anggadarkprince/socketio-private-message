'use strict';

const SelectUsername = ({onSelectUsername}) => {
    const [username, setUsername] = React.useState('');

    return (
        <div className="my-5">
            <form id="username-form" onSubmit={(e) => {
                e.preventDefault();
                onSelectUsername(username);
            }}>
                <div className="row g-3">
                    <div className="col-sm-10">
                        <input type="text" id="user-message" placeholder="Enter username"
                               onChange={(e) => setUsername(e.target.value)}
                               className="form-control" value={username}/>
                    </div>
                    <div className="col-sm-2">
                        <div className="d-grid">
                            <button type="submit" className="btn btn-primary">
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

const UserStatus = ({connected, isSelected}) => {
    return (
        <div className={`small${!isSelected && (connected ? ' text-success' : ' text-danger')}`}>
            {connected ? "online" : "offline"}
        </div>
    )
}

const User = ({user, isSelected, setSelectedUser}) => {
    return (
        <div className={`list-group-item${isSelected ? ' active' : ''} d-flex justify-content-between align-items-center`} onClick={() => setSelectedUser(user)}>
            <div>
                <div className="fw-bold">
                    {user.username} {user.self ? " (yourself)" : ""}
                </div>
                <UserStatus connected={user.connected} isSelected={isSelected} />
            </div>
            <div className="badge bg-primary rounded-pill">
                {user.hasNewMessages ? 'NEW' : ''}
            </div>
        </div>
    );
}

const MessagePanel = ({user, onMessage}) => {
    const [message, setMessage] = React.useState('');
    return (
        <div>
            <div className="d-flex justify-content-between align-items-center border-bottom py-3">
                <p className="fw-bold mb-0">{user.username}</p>
                <UserStatus connected={user.connected} />
            </div>

            <ul className="list-group py-3">
                {user.messages.map((item, index) => {
                    return (
                        <li key={`message-${user.userID}-${index}`} className={`list-group-item list-group-item-${item.fromSelf ? 'primary' : 'warning'} mb-2 w-50${item.fromSelf ? ' ms-auto' : ''}`}>
                            <p className="fw-bold mb-0">{item.content}</p>
                            <small className="text-muted">
                                {item.fromSelf ? "(yourself)" : user.username}
                            </small>
                        </li>
                    )
                })}
            </ul>

            <form onSubmit={(e) => {
                e.preventDefault();
                onMessage(message);
                setMessage('');
            }}>
                <textarea
                    placeholder="Your message..."
                    className="form-control mb-2"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">Send</button>
            </form>
        </div>
    );
}

const Chat = ({socket}) => {
    const [selectedUser, setSelectedUser] = React.useState(null);
    const [users, setUsers] = React.useState([]);

    React.useEffect(() => {
        socket.on("connect", () => {
            users.forEach((user) => {
                if (user.self) {
                    console.log('i am connected!');
                    user.connected = true;
                }
            });
        });

        socket.on("disconnect", () => {
            users.forEach((user) => {
                if (user.self) {
                    console.log('i am disconnected!');
                    user.connected = false;
                }
            });
        });

        const initReactiveProperties = (user) => {
            user.connected = true;
            user.messages = [];
            user.hasNewMessages = false;
        };

        // get all users on the first time
        socket.on("users", (users) => {
            console.log('user list', users);
            users.forEach((user) => {
                user.self = user.userID === socket.id;
                initReactiveProperties(user);
            });
            // put the current user first, and sort by username
            const userList = users.sort((a, b) => {
                if (a.self) return -1;
                if (b.self) return 1;
                if (a.username < b.username) return -1;
                return a.username > b.username ? 1 : 0;
            });
            setUsers(userList);
        });

        // listen when new user joined
        socket.on("user connected", (user) => {
            console.log('user connected', user);
            initReactiveProperties(user);
            setUsers(prevState => {
                return [...prevState, user];
            });
        });

        // listen when user is disconnected
        socket.on("user disconnected", (id) => {
            console.log('user disconnected', id);
            setUsers(prevState => {
                return prevState.map(user => {
                    if (user.userID === id) {
                        user.connected = false;
                    }
                    return user;
                });
            })
        });

        // listen when other user send message
        socket.on("private message", ({content, from}) => {
            console.log('receive message', {content, from});
            setUsers(prevState => {
                return prevState.map(user => {
                    if (user.userID === from) {
                        user.messages = [...user.messages, {
                            content,
                            fromSelf: false,
                        }];
                        if (user.userID !== (selectedUser && selectedUser.userID)) {
                            user.hasNewMessages = true;
                        }
                    }
                    return user;
                });
            });
        });

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("users");
            socket.off("user connected");
            socket.off("user disconnected");
            socket.off("private message");
        }
    }, []);

    const onSelectUser = (user) => {
        user.hasNewMessages = false;
        setSelectedUser(user);
    }

    const onMessage = (content) => {
        console.log('submit', content, selectedUser);
        if (selectedUser) {
            socket.emit("private message", {
                content,
                to: selectedUser.userID,
            });
            const newMessage = {
                content: content,
                fromSelf: true,
            };
            setUsers(prevState => {
                return prevState.map(user => {
                    if (user.userID === selectedUser.userID) {
                        user.messages.push(newMessage);
                    }
                    return user;
                });
            })
            /*const newSelectedUsers = {
                ...selectedUser,
                messages: [...selectedUser.messages, newMessage]
            }
            setSelectedUser(newSelectedUsers);*/
        }
    }

    return (
        <div className="row">
            <div className="col-4">
                <div className="list-group list-group-flush">
                    {users.map(user => {
                        return (
                            <User
                                key={user.userID}
                                user={user}
                                isSelected={(selectedUser && selectedUser.userID) === user.userID}
                                setSelectedUser={onSelectUser}
                            />
                        )
                    })}
                </div>
            </div>
            <div className="col-8">
                {selectedUser && <MessagePanel user={selectedUser} onMessage={onMessage} />}
            </div>
        </div>
    );
}


class App extends React.Component {
    constructor(props) {
        super(props);
        this.socket = io("http://localhost:3000", {autoConnect: false});

        this.state = {
            usernameSelected: false,
            username: false,
        };

        this.onSelectUsername = this.onSelectUsername.bind(this);
    }

    onSelectUsername(username) {
        this.setState({
            usernameSelected: true,
            username: username
        });
        this.socket.auth = {username};
        this.socket.connect();
    }

    render() {
        return (
            <div className="container">
                {
                    this.state.usernameSelected
                        ? <Chat socket={this.socket}>chat</Chat>
                        : <SelectUsername onSelectUsername={this.onSelectUsername}/>
                }
            </div>
        );
    }
}

const domContainer = document.querySelector('#app');
const root = ReactDOM.createRoot(domContainer);
root.render(<App/>);