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

// =====================================================
// SOCKET.IO
// =====================================================

const io = new Server(server, {
  cors: {
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173",

    methods: ["GET", "POST"]
  }
});

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:5173"
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

const User = mongoose.model(
  "User",
  UserSchema
);

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
// JWT
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
  } catch (error) {
    return res.status(401).json({
      message:
        "Invalid or expired token"
    });
  }
}

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true
    });
  }
);

// =====================================================
// ROOT
// =====================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      message:
        "WhatsApp Email Chat Backend is running",

      status: "OK"
    });
  }
);

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

      if (
        !name ||
        !email ||
        !password
      ) {
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

      const normalizedEmail =
        email
          .toLowerCase()
          .trim();

      const existingUser =
        await User.findOne({
          email: normalizedEmail
        });

      if (existingUser) {
        return res.status(409).json({
          message:
            "Email already registered"
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      const user =
        await User.create({
          name,
          email: normalizedEmail,
          password: hashedPassword
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
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      res.status(500).json({
        message:
          "Registration failed"
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

      const normalizedEmail =
        (email || "")
          .toLowerCase()
          .trim();

      const user =
        await User.findOne({
          email: normalizedEmail
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
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        message:
          "Login failed"
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
    try {
      const user =
        await User.findById(
          req.userId
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          message:
            "User not found"
        });
      }

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      });
    } catch (error) {
      console.error(
        "Get current user error:",
        error
      );

      res.status(500).json({
        message:
          "Could not get user"
      });
    }
  }
);

// =====================================================
// EXACT EMAIL SEARCH
// =====================================================

app.get(
  "/api/users/search",

  auth,

  async (req, res) => {
    try {
      const email =
        (req.query.email || "")
          .toLowerCase()
          .trim();

      if (!email) {
        return res.json({
          user: null
        });
      }

      const user =
        await User.findOne({
          email
        }).select(
          "_id name email avatar lastSeen"
        );

      if (
        !user ||
        user._id.toString() ===
          req.userId
      ) {
        return res.json({
          user: null
        });
      }

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,

          online:
            onlineUsers.has(
              user._id.toString()
            ),

          lastSeen:
            user.lastSeen
        }
      });
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      res.status(500).json({
        message:
          "Search failed"
      });
    }
  }
);

// =====================================================
// RECENT CHATS
// =====================================================

app.get(
  "/api/conversations",

  auth,

  async (req, res) => {
    try {
      const conversations =
        await Conversation.find({
          participants:
            req.userId
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
          .map(
            (conversation) => {
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

                name:
                  otherUser.name,

                email:
                  otherUser.email,

                avatar:
                  otherUser.avatar,

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
            }
          )
          .filter(Boolean);

      res.json({
        conversations:
          result
      });
    } catch (error) {
      console.error(
        "Recent chats error:",
        error
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
      const otherUserId =
        req.params.userId;

      const messages =
        await Message.find({
          $or: [
            {
              sender:
                req.userId,

              receiver:
                otherUserId
            },

            {
              sender:
                otherUserId,

              receiver:
                req.userId
            }
          ]
        })
          .sort({
            createdAt: 1
          })
          .limit(500);

      // Mark received messages as read
      await Message.updateMany(
        {
          sender:
            otherUserId,

          receiver:
            req.userId,

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
    } catch (error) {
      console.error(
        "Get messages error:",
        error
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
        !text ||
        !text.trim()
      ) {
        return res.status(400).json({
          message:
            "Receiver and message are required"
        });
      }

      const cleanText =
        text.trim();

      // -------------------------------------------------
      // CREATE MESSAGE
      // -------------------------------------------------

      const message =
        await Message.create({
          sender:
            req.userId,

          receiver:
            receiver,

          text:
            cleanText
        });

      // -------------------------------------------------
      // FIND CONVERSATION
      // -------------------------------------------------

      let conversation =
        await Conversation.findOne({
          participants: {
            $all: [
              req.userId,
              receiver
            ]
          }
        });

      // -------------------------------------------------
      // CREATE CONVERSATION
      // -------------------------------------------------

      if (!conversation) {
        conversation =
          await Conversation.create({
            participants: [
              req.userId,
              receiver
            ],

            lastMessage:
              cleanText,

            lastMessageAt:
              new Date()
          });
      }

      // -------------------------------------------------
      // UPDATE CONVERSATION
      // -------------------------------------------------

      else {
        conversation.lastMessage =
          cleanText;

        conversation.lastMessageAt =
          new Date();

        await conversation.save();
      }

      // -------------------------------------------------
      // POPULATE SENDER
      // -------------------------------------------------

      const populatedMessage =
        await message.populate(
          "sender",
          "name email avatar"
        );

      const payload =
        populatedMessage.toObject();

      // -------------------------------------------------
      // SEND MESSAGE TO RECEIVER
      // -------------------------------------------------

      io
        .to(
          `user:${receiver}`
        )
        .emit(
          "message:new",
          payload
        );

      // -------------------------------------------------
      // SEND MESSAGE TO SENDER
      // -------------------------------------------------

      io
        .to(
          `user:${req.userId}`
        )
        .emit(
          "message:sent",
          payload
        );

      // -------------------------------------------------
      // UPDATE RECEIVER RECENT CHAT
      // -------------------------------------------------

      io
        .to(
          `user:${receiver}`
        )
        .emit(
          "conversation:update",
          {
            userId:
              req.userId,

            lastMessage:
              cleanText,

            lastMessageAt:
              conversation.lastMessageAt
          }
        );

      // -------------------------------------------------
      // UPDATE SENDER RECENT CHAT
      // -------------------------------------------------

      io
        .to(
          `user:${req.userId}`
        )
        .emit(
          "conversation:update",
          {
            userId:
              receiver,

            lastMessage:
              cleanText,

            lastMessageAt:
              conversation.lastMessageAt
          }
        );

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(201).json({
        message:
          payload
      });

    } catch (error) {
      console.error(
        "SEND MESSAGE ERROR:",
        error
      );

      return res.status(500).json({
        message:
          error.message ||
          "Message sending failed"
      });
    }
  }
);

// =====================================================
// SOCKET AUTH
// =====================================================

io.use(
  (socket, next) => {
    try {
      const token =
        socket.handshake
          .auth?.token;

      if (!token) {
        return next(
          new Error(
            "Unauthorized"
          )
        );
      }

      const payload =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      socket.userId =
        payload.id;

      next();

    } catch (error) {
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

    const userId =
      socket.userId;

    // -------------------------------------------------
    // USER ROOM
    // -------------------------------------------------

    socket.join(
      `user:${userId}`
    );

    // -------------------------------------------------
    // ONLINE USER COUNT
    // -------------------------------------------------

    onlineUsers.set(
      userId,

      (onlineUsers.get(
        userId
      ) || 0) + 1
    );

    io.emit(
      "presence",
      {
        userId,
        online: true
      }
    );

    // -------------------------------------------------
    // TYPING
    // -------------------------------------------------

    socket.on(
      "typing",

      ({ receiver }) => {

        if (!receiver) {
          return;
        }

        io
          .to(
            `user:${receiver}`
          )
          .emit(
            "typing",
            {
              userId
            }
          );
      }
    );

    // -------------------------------------------------
    // STOP TYPING
    // -------------------------------------------------

    socket.on(
      "stopTyping",

      ({ receiver }) => {

        if (!receiver) {
          return;
        }

        io
          .to(
            `user:${receiver}`
          )
          .emit(
            "stopTyping",
            {
              userId
            }
          );
      }
    );

    // -------------------------------------------------
    // MESSAGE READ
    // -------------------------------------------------

    socket.on(
      "message:read",

      async ({
        messageId,
        senderId
      }) => {

        try {

          await Message.findOneAndUpdate(
            {
              _id:
                messageId,

              receiver:
                userId
            },

            {
              $set: {
                read: true
              }
            }
          );

          if (senderId) {

            io
              .to(
                `user:${senderId}`
              )
              .emit(
                "message:read",
                {
                  messageId
                }
              );

          }

        } catch (error) {

          console.error(
            "Message read error:",
            error
          );

        }
      }
    );

    // -------------------------------------------------
    // DISCONNECT
    // -------------------------------------------------

    socket.on(
      "disconnect",

      async () => {

        const count =
          (onlineUsers.get(
            userId
          ) || 1) - 1;

        if (count <= 0) {

          onlineUsers.delete(
            userId
          );

          const lastSeen =
            new Date();

          await User.findByIdAndUpdate(
            userId,

            {
              lastSeen
            }
          );

          io.emit(
            "presence",
            {
              userId,

              online:
                false,

              lastSeen
            }
          );

        } else {

          onlineUsers.set(
            userId,
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
      "MongoDB Connected Successfully"
    );

    const PORT =
      process.env.PORT ||
      5000;

    server.listen(
      PORT,

      () => {

        console.log(
          `Server running on port ${PORT}`
        );

      }
    );

  })

  .catch(
    (error) => {

      console.error(
        "MongoDB connection failed:",
        error.message
      );

      process.exit(1);

    }
  );