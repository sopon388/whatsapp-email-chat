require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173"
  })
);

app.use(express.json());


// =====================================================
// USER SCHEMA
// =====================================================

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    password: {
      type: String,
      required: true
    },

    avatar: {
      type: String,
      default: ""
    },

    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);


// =====================================================
// MESSAGE SCHEMA
// =====================================================

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);


// =====================================================
// CONVERSATION SCHEMA
// =====================================================

const ConversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],

    lastMessage: {
      type: String,
      default: ""
    },

    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

ConversationSchema.index({
  participants: 1
});


// =====================================================
// MODELS
// =====================================================

const User = mongoose.model("User", UserSchema);

const Message = mongoose.model(
  "Message",
  MessageSchema
);

const Conversation = mongoose.model(
  "Conversation",
  ConversationSchema
);


// =====================================================
// ONLINE USERS
// =====================================================

const onlineUsers = new Map();


// =====================================================
// JWT TOKEN
// =====================================================

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString()
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}


// =====================================================
// AUTH MIDDLEWARE
// =====================================================

function auth(req, res, next) {
  try {
    const token = (
      req.headers.authorization || ""
    ).replace("Bearer ", "");

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.userId = payload.id;

    next();
  } catch (e) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
}


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true
  });
});


// =====================================================
// ROOT
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "WhatsApp Email Chat Backend is running",
    status: "OK"
  });
});


// =====================================================
// REGISTER
// =====================================================

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password
      } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          message:
            "Name, email and password are required"
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message:
            "Password must be at least 6 characters"
        });
      }

      const normalized =
        email.toLowerCase().trim();

      if (
        await User.findOne({
          email: normalized
        })
      ) {
        return res.status(409).json({
          message:
            "Email already registered"
        });
      }

      const hash =
        await bcrypt.hash(password, 12);

      const user = await User.create({
        name,
        email: normalized,
        password: hash
      });

      res.status(201).json({
        token: signToken(user),

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      });
    } catch (e) {
      console.error(
        "Registration error:",
        e.message
      );

      res.status(500).json({
        message: "Registration failed"
      });
    }
  }
);


// =====================================================
// LOGIN
// =====================================================

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password
      } = req.body;

      const user =
        await User.findOne({
          email: (email || "")
            .toLowerCase()
            .trim()
        });

      if (
        !user ||
        !(await bcrypt.compare(
          password || "",
          user.password
        ))
      ) {
        return res.status(401).json({
          message:
            "Invalid email or password"
        });
      }

      res.json({
        token: signToken(user),

        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      });
    } catch (e) {
      console.error(
        "Login error:",
        e.message
      );

      res.status(500).json({
        message: "Login failed"
      });
    }
  }
);


// =====================================================
// CURRENT USER
// =====================================================

app.get(
  "/api/auth/me",
  auth,
  async (req, res) => {
    const u =
      await User.findById(
        req.userId
      ).select("-password");

    if (!u) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar
      }
    });
  }
);


// =====================================================
// SEARCH USER BY EXACT EMAIL
// =====================================================

app.get(
  "/api/users/search",
  auth,
  async (req, res) => {
    const email = (
      req.query.email || ""
    )
      .toLowerCase()
      .trim();

    if (!email) {
      return res.json({
        user: null
      });
    }

    const u =
      await User.findOne({
        email
      }).select(
        "_id name email avatar lastSeen"
      );

    if (
      !u ||
      u._id.toString() ===
        req.userId
    ) {
      return res.json({
        user: null
      });
    }

    res.json({
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,

        online:
          onlineUsers.has(
            u._id.toString()
          ),

        lastSeen: u.lastSeen
      }
    });
  }
);


// =====================================================
// GET RECENT CHATS
// =====================================================

app.get(
  "/api/conversations",
  auth,
  async (req, res) => {
    try {
      const conversations =
        await Conversation.find({
          participants: req.userId
        })
          .populate(
            "participants",
            "_id name email avatar lastSeen"
          )
          .sort({
            lastMessageAt: -1
          });

      const result =
        conversations
          .map((conversation) => {
            const otherUser =
              conversation.participants.find(
                (user) =>
                  user._id.toString() !==
                  req.userId
              );

            if (!otherUser) {
              return null;
            }

            return {
              id: otherUser._id,
              name: otherUser.name,
              email: otherUser.email,
              avatar: otherUser.avatar,

              online:
                onlineUsers.has(
                  otherUser._id.toString()
                ),

              lastSeen:
                otherUser.lastSeen,

              lastMessage:
                conversation.lastMessage,

              lastMessageAt:
                conversation.lastMessageAt
            };
          })
          .filter(Boolean);

      res.json({
        conversations: result
      });
    } catch (e) {
      console.error(
        "Conversation fetch error:",
        e.message
      );

      res.status(500).json({
        message:
          "Could not load conversations"
      });
    }
  }
);


// =====================================================
// GET MESSAGES
// =====================================================

app.get(
  "/api/messages/:userId",
  auth,
  async (req, res) => {
    try {
      const other =
        req.params.userId;

      const messages =
        await Message.find({
          $or: [
            {
              sender: req.userId,
              receiver: other
            },
            {
              sender: other,
              receiver: req.userId
            }
          ]
        })
          .sort({
            createdAt: 1
          })
          .limit(500);

      await Message.updateMany(
        {
          sender: other,
          receiver: req.userId,
          read: false
        },
        {
          $set: {
            read: true
          }
        }
      );

      res.json({
        messages
      });
    } catch (e) {
      console.error(
        "Get messages error:",
        e.message
      );

      res.status(500).json({
        message:
          "Could not load messages"
      });
    }
  }
);


// =====================================================
// SEND MESSAGE
// =====================================================

app.post(
  "/api/messages",
  auth,
  async (req, res) => {
    try {
      const {
        receiver,
        text
      } = req.body;

      if (
        !receiver ||
        !text?.trim()
      ) {
        return res.status(400).json({
          message:
            "Receiver and message are required"
        });
      }

      const msg =
        await Message.create({
          sender: req.userId,
          receiver,
          text: text.trim()
        });


      // =================================================
      // CREATE / UPDATE CONVERSATION
      // =================================================

      const conversation =
        await Conversation.findOneAndUpdate(
          {
            participants: {
              $all: [
                req.userId,
                receiver
              ]
            }
          },
          {
            $set: {
              lastMessage:
                text.trim(),

              lastMessageAt:
                new Date()
            },

            $addToSet: {
              participants: {
                $each: [
                  req.userId,
                  receiver
                ]
              }
            }
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );


      const populated =
        await msg.populate(
          "sender",
          "name email avatar"
        );

      const payload =
        populated.toObject();


      // =================================================
      // SEND MESSAGE TO RECEIVER
      // =================================================

      io
        .to(`user:${receiver}`)
        .emit(
          "message:new",
          payload
        );


      // =================================================
      // SEND MESSAGE TO SENDER
      // =================================================

      io
        .to(`user:${req.userId}`)
        .emit(
          "message:sent",
          payload
        );


      // =================================================
      // SEND CHAT LIST UPDATE
      // =================================================

      io
        .to(`user:${receiver}`)
        .emit(
          "conversation:update",
          {
            userId: req.userId,
            lastMessage:
              text.trim(),
            lastMessageAt:
              conversation.lastMessageAt
          }
        );

      io
        .to(`user:${req.userId}`)
        .emit(
          "conversation:update",
          {
            userId: receiver,
            lastMessage:
              text.trim(),
            lastMessageAt:
              conversation.lastMessageAt
          }
        );


      res.status(201).json({
        message: payload
      });
    } catch (e) {
      console.error(
        "Send message error:",
        e.message
      );

      res.status(500).json({
        message:
          "Message sending failed"
      });
    }
  }
);


// =====================================================
// SOCKET AUTHENTICATION
// =====================================================

io.use(
  (socket, next) => {
    try {
      const token =
        socket.handshake
          .auth?.token;

      const payload =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      socket.userId =
        payload.id;

      next();
    } catch (e) {
      next(
        new Error(
          "Unauthorized"
        )
      );
    }
  }
);


// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
  "connection",
  (socket) => {
    const id =
      socket.userId;

    socket.join(
      `user:${id}`
    );

    onlineUsers.set(
      id,
      (onlineUsers.get(id) || 0) + 1
    );

    io.emit("presence", {
      userId: id,
      online: true
    });


    // =================================================
    // TYPING
    // =================================================

    socket.on(
      "typing",
      ({ receiver }) => {
        if (receiver) {
          io
            .to(`user:${receiver}`)
            .emit(
              "typing",
              {
                userId: id
              }
            );
        }
      }
    );


    // =================================================
    // STOP TYPING
    // =================================================

    socket.on(
      "stopTyping",
      ({ receiver }) => {
        if (receiver) {
          io
            .to(`user:${receiver}`)
            .emit(
              "stopTyping",
              {
                userId: id
              }
            );
        }
      }
    );


    // =================================================
    // MESSAGE READ
    // =================================================

    socket.on(
      "message:read",
      async ({
        messageId,
        senderId
      }) => {
        try {
          await Message.findOneAndUpdate(
            {
              _id: messageId,
              receiver: id
            },
            {
              $set: {
                read: true
              }
            }
          );

          if (senderId) {
            io
              .to(`user:${senderId}`)
              .emit(
                "message:read",
                {
                  messageId
                }
              );
          }
        } catch (e) {}
      }
    );


    // =================================================
    // DISCONNECT
    // =================================================

    socket.on(
      "disconnect",
      async () => {
        const count =
          (onlineUsers.get(id) || 1) -
          1;

        if (count <= 0) {
          onlineUsers.delete(id);

          await User.findByIdAndUpdate(
            id,
            {
              lastSeen:
                new Date()
            }
          );

          io.emit("presence", {
            userId: id,
            online: false,
            lastSeen:
              new Date()
          });
        } else {
          onlineUsers.set(
            id,
            count
          );
        }
      }
    );
  }
);


// =====================================================
// MONGODB CONNECTION
// =====================================================

mongoose
  .connect(
    process.env.MONGO_URI
  )
  .then(() => {
    console.log(
      "✅ MongoDB Connected Successfully"
    );

    server.listen(
      process.env.PORT || 5000,
      () => {
        console.log(
          `🚀 Server running on port ${
            process.env.PORT || 5000
          }`
        );
      }
    );
  })
  .catch((err) => {
    console.error(
      "❌ MongoDB connection failed:",
      err.message
    );

    process.exit(1);
  });