import React, {
  useEffect,
  useRef,
  useState
} from "react";

import axios from "axios";

import { io } from "socket.io-client";

import {
  Search,
  Send,
  LogOut,
  MessageCircle,
  Check,
  CheckCheck,
  ArrowLeft
} from "lucide-react";


const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";


const api = axios.create({
  baseURL: API
});


function setAuth(token) {
  api.defaults.headers.common.Authorization =
    `Bearer ${token}`;
}


// =====================================================
// APP
// =====================================================

export default function App() {

  const [token, setToken] =
    useState(
      localStorage.getItem("token")
    );

  const [me, setMe] =
    useState(null);

  const [authMode, setAuthMode] =
    useState("login");

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [searchEmail, setSearchEmail] =
    useState("");

  const [found, setFound] =
    useState(null);

  const [recentChats, setRecentChats] =
    useState([]);

  const [chat, setChat] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [text, setText] =
    useState("");

  const [typing, setTyping] =
    useState(false);

  const [online, setOnline] =
    useState(false);

  const socketRef =
    useRef(null);

  const bottom =
    useRef(null);

  const typingTimer =
    useRef(null);

  const chatRef =
    useRef(null);


  // =====================================================
  // KEEP LATEST CHAT
  // =====================================================

  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);


  // =====================================================
  // GET CURRENT USER
  // =====================================================

  useEffect(() => {

    if (!token) return;

    setAuth(token);

    api
      .get("/api/auth/me")
      .then((r) => {
        setMe(r.data.user);
      })
      .catch(() => {
        logout();
      });

  }, [token]);


  // =====================================================
  // LOAD RECENT CHATS
  // =====================================================

  useEffect(() => {

    if (!token) return;

    loadRecentChats();

  }, [token]);


  async function loadRecentChats() {

    try {

      const response =
        await api.get(
          "/api/conversations"
        );

      setRecentChats(
        response.data.conversations || []
      );

    } catch (error) {

      console.error(
        "Recent chats error:",
        error.response?.data ||
          error.message
      );

    }
  }


  // =====================================================
  // SOCKET.IO
  // =====================================================

  useEffect(() => {

    if (!token) return;

    const socket =
      io(API, {
        auth: {
          token
        }
      });

    socketRef.current =
      socket;


    socket.on(
      "connect",
      () => {
        console.log(
          "Socket connected:",
          socket.id
        );
      }
    );


    socket.on(
      "connect_error",
      (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );
      }
    );


    // =================================================
    // NEW MESSAGE
    // =================================================

    socket.on(
      "message:new",
      (message) => {

        const currentChat =
          chatRef.current;

        if (!currentChat) return;

        const senderId =
          typeof message.sender ===
          "object"
            ? message.sender?._id
            : message.sender;

        if (
          String(senderId) ===
          String(currentChat.id)
        ) {

          setMessages(
            (previous) => {

              const exists =
                previous.some(
                  (item) =>
                    String(item._id) ===
                    String(message._id)
                );

              if (exists) {
                return previous;
              }

              return [
                ...previous,
                message
              ];
            }
          );

        }
      }
    );


    // =================================================
    // MESSAGE SENT
    // =================================================

    socket.on(
      "message:sent",
      (message) => {

        const currentChat =
          chatRef.current;

        if (!currentChat) return;

        const receiverId =
          typeof message.receiver ===
          "object"
            ? message.receiver?._id
            : message.receiver;

        if (
          String(receiverId) ===
          String(currentChat.id)
        ) {

          setMessages(
            (previous) => {

              const exists =
                previous.some(
                  (item) =>
                    String(item._id) ===
                    String(message._id)
                );

              if (exists) {
                return previous;
              }

              return [
                ...previous,
                message
              ];
            }
          );

        }
      }
    );


    // =================================================
    // CONVERSATION UPDATE
    // =================================================

    socket.on(
      "conversation:update",
      (data) => {

        setRecentChats(
          (previous) => {

            const index =
              previous.findIndex(
                (item) =>
                  String(item.id) ===
                  String(data.userId)
              );


            // =========================================
            // EXISTING CHAT
            // =========================================

            if (index !== -1) {

              const updated = {
                ...previous[index],

                lastMessage:
                  data.lastMessage,

                lastMessageAt:
                  data.lastMessageAt
              };

              const newList =
                [...previous];

              newList.splice(
                index,
                1
              );

              newList.unshift(
                updated
              );

              return newList;
            }


            // =========================================
            // NEW CHAT
            // =========================================

            loadRecentChats();

            return previous;
          }
        );

      }
    );


    // =================================================
    // TYPING
    // =================================================

    socket.on(
      "typing",
      (data) => {

        const currentChat =
          chatRef.current;

        if (
          currentChat &&
          String(currentChat.id) ===
          String(data.userId)
        ) {

          setTyping(true);

        }
      }
    );


    // =================================================
    // STOP TYPING
    // =================================================

    socket.on(
      "stopTyping",
      (data) => {

        const currentChat =
          chatRef.current;

        if (
          currentChat &&
          String(currentChat.id) ===
          String(data.userId)
        ) {

          setTyping(false);

        }
      }
    );


    // =================================================
    // ONLINE / OFFLINE
    // =================================================

    socket.on(
      "presence",
      (data) => {

        const currentChat =
          chatRef.current;

        setRecentChats(
          (previous) =>
            previous.map(
              (item) =>
                String(item.id) ===
                String(data.userId)
                  ? {
                      ...item,
                      online:
                        data.online,
                      lastSeen:
                        data.lastSeen
                    }
                  : item
            )
        );


        if (
          currentChat &&
          String(currentChat.id) ===
          String(data.userId)
        ) {

          setOnline(
            data.online
          );

        }
      }
    );


    // =================================================
    // MESSAGE READ
    // =================================================

    socket.on(
      "message:read",
      (data) => {

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                String(message._id) ===
                String(data.messageId)
                  ? {
                      ...message,
                      read: true
                    }
                  : message
            )
        );

      }
    );


    // =================================================
    // CLEANUP
    // =================================================

    return () => {

      socket.disconnect();

      socketRef.current =
        null;

    };

  }, [token]);


  // =====================================================
  // AUTO SCROLL
  // =====================================================

  useEffect(() => {

    bottom.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [messages, typing]);


  // =====================================================
  // LOGIN / REGISTER
  // =====================================================

  async function submitAuth(e) {

    e.preventDefault();

    try {

      const url =
        authMode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";


      const response =
        await api.post(
          url,
          {
            name,
            email,
            password
          }
        );


      localStorage.setItem(
        "token",
        response.data.token
      );


      setToken(
        response.data.token
      );


      setMe(
        response.data.user
      );


      setName("");
      setEmail("");
      setPassword("");

    } catch (error) {

      console.error(
        "Authentication error:",
        error.response?.data ||
          error.message
      );

      alert(
        error.response?.data?.message ||
        "Something went wrong"
      );

    }

  }


  // =====================================================
  // SEARCH USER
  // =====================================================

  async function search() {

    if (!searchEmail.trim()) {
      return;
    }

    try {

      const response =
        await api.get(
          `/api/users/search?email=${encodeURIComponent(
            searchEmail.trim()
          )}`
        );


      setFound(
        response.data.user
      );


      if (!response.data.user) {

        alert(
          "No user found with this email"
        );

      }

    } catch (error) {

      console.error(
        "Search error:",
        error.response?.data ||
          error.message
      );

      alert(
        "Search failed"
      );

    }

  }


  // =====================================================
  // OPEN CHAT
  // =====================================================

  async function openChat(user) {

    try {

      setChat(user);

      chatRef.current =
        user;

      setFound(null);

      setSearchEmail("");

      setTyping(false);

      setOnline(
        !!user.online
      );


      const response =
        await api.get(
          `/api/messages/${user.id}`
        );


      setMessages(
        response.data.messages || []
      );


      // Make sure chat exists in recent chats
      setRecentChats(
        (previous) => {

          const exists =
            previous.some(
              (item) =>
                String(item.id) ===
                String(user.id)
            );


          if (exists) {
            return previous;
          }


          return [
            {
              ...user,
              lastMessage: "",
              lastMessageAt:
                new Date()
            },
            ...previous
          ];

        }
      );

    } catch (error) {

      console.error(
        "Open chat error:",
        error.response?.data ||
          error.message
      );

      alert(
        "Could not load messages"
      );

    }

  }


  // =====================================================
  // SEND MESSAGE
  // =====================================================

  async function send() {

    if (
      !text.trim() ||
      !chat
    ) {
      return;
    }


    const body =
      text.trim();


    setText("");


    socketRef.current?.emit(
      "stopTyping",
      {
        receiver:
          chat.id
      }
    );


    try {

      const response =
        await api.post(
          "/api/messages",
          {
            receiver:
              chat.id,

            text:
              body
          }
        );


      const sentMessage =
        response.data.message;


      if (sentMessage) {

        setMessages(
          (previous) => {

            const exists =
              previous.some(
                (item) =>
                  String(item._id) ===
                  String(
                    sentMessage._id
                  )
              );


            if (exists) {
              return previous;
            }


            return [
              ...previous,
              sentMessage
            ];

          }
        );

      }


    } catch (error) {

      console.error(
        "Message sending error:",
        error.response?.data ||
          error.message
      );


      setText(body);


      alert(
        error.response?.data?.message ||
        "Message failed"
      );

    }

  }


  // =====================================================
  // TYPING
  // =====================================================

  function handleTyping(e) {

    const value =
      e.target.value;


    setText(value);


    if (!chat) return;


    socketRef.current?.emit(
      "typing",
      {
        receiver:
          chat.id
      }
    );


    clearTimeout(
      typingTimer.current
    );


    typingTimer.current =
      setTimeout(
        () => {

          socketRef.current?.emit(
            "stopTyping",
            {
              receiver:
                chat.id
            }
          );

        },
        900
      );

  }


  // =====================================================
  // LOGOUT
  // =====================================================

  function logout() {

    localStorage.removeItem(
      "token"
    );


    socketRef.current?.disconnect();


    setToken(null);

    setMe(null);

    setChat(null);

    setMessages([]);

    setFound(null);

    setRecentChats([]);

  }


  // =====================================================
  // FORMAT TIME
  // =====================================================

  function formatChatTime(date) {

    if (!date) {
      return "";
    }


    return new Date(
      date
    ).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  }


  // =====================================================
  // AUTH SCREEN
  // =====================================================

  if (!token || !me) {

    return (
      <Auth
        mode={authMode}
        setMode={setAuthMode}

        name={name}
        setName={setName}

        email={email}
        setEmail={setEmail}

        password={password}
        setPassword={setPassword}

        submit={submitAuth}
      />
    );

  }


  // =====================================================
  // MAIN APP
  // =====================================================

  return (

    <div className="app">


      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={
          chat
            ? "sidebar mobile-hide"
            : "sidebar"
        }
      >


        {/* HEADER */}

        <header>

          <div className="brand">

            <MessageCircle />

            ChatApp

          </div>


          <button
            onClick={logout}
            title="Logout"
          >

            <LogOut size={19} />

          </button>

        </header>


        {/* CURRENT USER */}

        <div className="me">

          <div className="avatar">

            {me.name?.[0]
              ?.toUpperCase()}

          </div>


          <div>

            <b>
              {me.name}
            </b>

            <small>
              {me.email}
            </small>

          </div>

        </div>


        {/* SEARCH */}

        <div className="search">

          <Search size={18} />


          <input
            placeholder="Search by exact email..."
            value={searchEmail}

            onChange={(e) =>
              setSearchEmail(
                e.target.value
              )
            }

            onKeyDown={(e) => {

              if (
                e.key === "Enter"
              ) {
                search();
              }

            }}
          />


          <button
            onClick={search}
          >
            Find
          </button>

        </div>


        {/* SEARCH RESULT */}

        {found && (

          <div
            className="found"
            onClick={() =>
              openChat(found)
            }
          >

            <div className="avatar">

              {found.name?.[0]
                ?.toUpperCase()}

            </div>


            <div>

              <b>
                {found.name}
              </b>

              <small>
                {found.email}
              </small>

            </div>

          </div>

        )}


        {/* =================================================
            RECENT CHATS
        ================================================= */}

        <div className="recent-title">

          RECENT CHATS

        </div>


        <div className="recent-chats">

          {recentChats.length === 0 ? (

            <div className="empty-side">

              <MessageCircle
                size={42}
              />

              <p>
                Search someone's email
                to start a direct chat.
              </p>

            </div>

          ) : (

            recentChats.map(
              (user) => (

                <div
                  key={user.id}
                  className={
                    "recent-chat " +
                    (
                      chat &&
                      String(chat.id) ===
                      String(user.id)
                        ? "active"
                        : ""
                    )
                  }

                  onClick={() =>
                    openChat(user)
                  }
                >


                  <div className="chat-avatar-wrapper">

                    <div className="avatar">

                      {user.name?.[0]
                        ?.toUpperCase()}

                    </div>


                    {user.online && (

                      <span className="online-dot" />

                    )}

                  </div>


                  <div className="recent-info">

                    <div className="recent-top">

                      <b>
                        {user.name}
                      </b>


                      <small>

                        {formatChatTime(
                          user.lastMessageAt
                        )}

                      </small>

                    </div>


                    <div className="recent-bottom">

                      <span>

                        {user.lastMessage ||
                          user.email}

                      </span>

                    </div>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </aside>


      {/* =================================================
          CHAT AREA
      ================================================= */}

      <main
        className={
          chat
            ? "chat"
            : "chat no-chat"
        }
      >


        {!chat ? (

          <div className="welcome">

            <MessageCircle
              size={65}
            />

            <h1>
              ChatApp
            </h1>

            <p>
              Search a user's exact
              email and message them
              directly.
            </p>

          </div>

        ) : (

          <>


            {/* CHAT HEADER */}

            <header className="chat-head">


              <button
                className="back"

                onClick={() => {

                  setChat(null);

                  chatRef.current =
                    null;

                  setMessages([]);

                  setTyping(false);

                }}
              >

                <ArrowLeft />

              </button>


              <div className="avatar">

                {chat.name?.[0]
                  ?.toUpperCase()}

              </div>


              <div>

                <b>
                  {chat.name}
                </b>


                <small>

                  {typing
                    ? "typing…"
                    : online
                    ? "online"
                    : "offline"}

                </small>

              </div>

            </header>


            {/* =================================================
                MESSAGES
            ================================================= */}

            <section className="messages">


              {messages.map(
                (message) => {

                  const senderId =
                    typeof message.sender ===
                    "object"
                      ? message.sender?._id
                      : message.sender;


                  const isMine =
                    String(
                      senderId
                    ) ===
                    String(me.id);


                  return (

                    <div
                      key={
                        message._id
                      }

                      className={
                        `bubble ${
                          isMine
                            ? "mine"
                            : "theirs"
                        }`
                      }
                    >

                      <span>
                        {message.text}
                      </span>


                      <small>

                        {new Date(
                          message.createdAt
                        ).toLocaleTimeString(
                          [],
                          {
                            hour:
                              "2-digit",

                            minute:
                              "2-digit"
                          }
                        )}


                        {isMine &&
                          (
                            message.read
                              ? (
                                <CheckCheck
                                  size={14}
                                />
                              )
                              : (
                                <Check
                                  size={14}
                                />
                              )
                          )}

                      </small>

                    </div>

                  );

                }
              )}


              <div ref={bottom} />

            </section>


            {/* MESSAGE COMPOSER */}

            <div className="composer">

              <input

                value={text}

                onChange={
                  handleTyping
                }

                onKeyDown={(e) => {

                  if (
                    e.key ===
                      "Enter" &&
                    !e.shiftKey
                  ) {

                    e.preventDefault();

                    send();

                  }

                }}

                placeholder="Type a message"

              />


              <button
                onClick={send}
              >

                <Send
                  size={20}
                />

              </button>

            </div>

          </>

        )}

      </main>

    </div>

  );

}


// =====================================================
// AUTH COMPONENT
// =====================================================

function Auth({
  mode,
  setMode,

  name,
  setName,

  email,
  setEmail,

  password,
  setPassword,

  submit
}) {

  return (

    <div className="auth">

      <form
        onSubmit={submit}
      >

        <div className="logo">

          <MessageCircle
            size={48}
          />

        </div>


        <h1>
          ChatApp
        </h1>


        <p>
          WhatsApp-style direct
          messaging by email
        </p>


        {mode === "register" && (

          <input
            placeholder="Your name"
            value={name}

            onChange={(e) =>
              setName(
                e.target.value
              )
            }

            required
          />

        )}


        <input
          type="email"
          placeholder="Email"
          value={email}

          onChange={(e) =>
            setEmail(
              e.target.value
            )
          }

          required
        />


        <input
          type="password"
          placeholder="Password (6+ characters)"
          value={password}

          onChange={(e) =>
            setPassword(
              e.target.value
            )
          }

          required
        />


        <button
          className="primary"
        >

          {mode === "login"
            ? "Login"
            : "Create account"}

        </button>


        <button
          type="button"
          className="switch"

          onClick={() =>
            setMode(
              mode === "login"
                ? "register"
                : "login"
            )
          }
        >

          {mode === "login"
            ? "Create a new account"
            : "Already have an account? Login"}

        </button>

      </form>

    </div>

  );
}