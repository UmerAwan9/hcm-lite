const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
let dbConnectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = mongoose
      .connect(process.env.MONGO_URI)
      .then(async () => {
        const email = String(process.env.ADMIN_EMAIL || "")
          .toLowerCase()
          .trim();

        const password = String(process.env.ADMIN_PASSWORD || "");

        if (email && password && !(await User.exists({ email }))) {
          await User.create({
            name: "System Admin",
            email,
            password: await bcrypt.hash(password, 10),
            role: "admin",
          });
        }
      })
      .catch((error) => {
        dbConnectionPromise = null;
        throw error;
      });
  }

  await dbConnectionPromise;
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({ message: "Database connection failed." });
  }
});

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "hr", "employee"],
      default: "employee",
    },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    basicSalary: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const AttendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    day: { type: String, required: true },
    checkIn: Date,
    checkOut: Date,
    status: {
      type: String,
      enum: ["present", "late", "missing_checkout"],
      default: "present",
    },
  },
  { timestamps: true },
);
AttendanceSchema.index({ employee: 1, day: 1 }, { unique: true });

const LeaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["casual", "sick", "unpaid"], required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewerComment: { type: String, default: "" },
  },
  { timestamps: true },
);

const PayrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
    },
    allowance: {
      type: Number,
      default: 0,
    },
    deduction: {
      type: Number,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
  },
  { timestamps: true },
);

PayrollSchema.index({ employee: 1, month: 1 }, { unique: true });

const User = mongoose.model("User", UserSchema);
const Attendance = mongoose.model("Attendance", AttendanceSchema);
const Leave = mongoose.model("Leave", LeaveSchema);
const Payroll = mongoose.model("Payroll", PayrollSchema);

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Please sign in." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Sign in again." });
  }
}
function roles(...allowed) {
  return (req, res, next) => {
    console.log("API:", req.method, req.originalUrl);
    console.log("Logged-in role:", req.user.role);
    console.log("Allowed roles:", allowed);

    return allowed.includes(req.user.role)
      ? next()
      : res.status(403).json({
          message: "You do not have permission for this action.",
        });
  };
}
function dayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
app.get("/api/health", (_req, res) => res.json({ ok: true, app: "HCM Lite" }));

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .toLowerCase()
      .trim();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email, active: true });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Invalid email or password." });
    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" },
    );
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Server error." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(user);
});

app.get("/api/employees", auth, roles("admin", "hr"), async (_req, res) => {
  const users = await User.find({ active: true })
    .select("-password")
    .sort({ createdAt: -1 });
  res.json(users);
});
app.post("/api/employees", auth, roles("admin", "hr"), async (req, res) => {
  try {
    const {
      name,
      email,
      department = "",
      designation = "",
      basicSalary = 0,
    } = req.body;
    if (
      !name?.trim() ||
      !email?.trim() ||
      !req.body.password ||
      !Number.isFinite(Number(basicSalary)) ||
      Number(basicSalary) < 0
    ) {
      return res.status(400).json({
        message: "Name, email, password and a valid salary are required.",
      });
    }
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(req.body.password, 10),
      department,
      designation,
      basicSalary: Number(basicSalary),
      role: "employee",
    });
    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
    });
  } catch (e) {
    res.status(e.code === 11000 ? 409 : 500).json({
      message:
        e.code === 11000
          ? "Email already exists."
          : "Could not create employee.",
    });
  }
});

app.get("/api/attendance", auth, async (req, res) => {
  const filter = req.user.role === "employee" ? { employee: req.user.id } : {};
  const records = await Attendance.find(filter)
    .populate("employee", "name email department")
    .sort({ day: -1 })
    .limit(200);
  res.json(records);
});
app.post(
  "/api/attendance/check-in",
  auth,
  roles("employee"),
  async (req, res) => {
    try {
      const day = dayKey();
      const existing = await Attendance.findOne({ employee: req.user.id, day });
      if (existing)
        return res
          .status(409)
          .json({ message: "You already checked in today." });
      const now = new Date();
      const late =
        now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
      const record = await Attendance.create({
        employee: req.user.id,
        day,
        checkIn: now,
        status: late ? "late" : "present",
      });
      res.status(201).json(record);
    } catch (e) {
      res.status(500).json({ message: "Could not check in." });
    }
  },
);
app.post(
  "/api/attendance/check-out",
  auth,
  roles("employee"),
  async (req, res) => {
    const record = await Attendance.findOne({
      employee: req.user.id,
      day: dayKey(),
    });
    if (!record) return res.status(404).json({ message: "Check in first." });
    if (record.checkOut)
      return res.status(409).json({ message: "Already checked out." });
    record.checkOut = new Date();
    await record.save();
    res.json(record);
  },
);

app.get(
  "/api/leaves",
  auth,
  roles("admin", "hr", "employee"),
  async (req, res) => {
    try {
      const filter =
        req.user.role === "employee" ? { employee: req.user.id } : {};

      const leaves = await Leave.find(filter)
        .populate("employee", "name email department")
        .sort({ createdAt: -1 });

      res.json(leaves);
    } catch (error) {
      res.status(500).json({
        message: "Could not fetch leave requests.",
      });
    }
  },
);

app.post("/api/leaves", auth, roles("employee"), async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (
      !["casual", "sick", "unpaid"].includes(type) ||
      !startDate ||
      !endDate ||
      !reason
    )
      return res.status(400).json({ message: "Complete all leave fields." });
    if (endDate < startDate)
      return res
        .status(422)
        .json({ message: "End date must be on or after start date." });
    const overlap = await Leave.findOne({
      employee: req.user.id,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (overlap)
      return res
        .status(422)
        .json({ message: "These dates overlap another leave request." });
    res.status(201).json(
      await Leave.create({
        employee: req.user.id,
        type,
        startDate,
        endDate,
        reason,
      }),
    );
  } catch {
    res.status(500).json({ message: "Could not submit leave." });
  }
});
app.patch(
  "/api/leaves/:id/review",
  auth,
  roles("admin", "hr"),
  async (req, res) => {
    if (!["approved", "rejected"].includes(req.body.status))
      return res.status(400).json({ message: "Choose approved or rejected." });
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
        reviewerComment: String(req.body.comment || ""),
      },
      { new: true },
    ).populate("employee", "name email");
    if (!leave)
      return res.status(404).json({ message: "Leave request not found." });
    res.json(leave);
  },
);

app.post("/api/payroll", auth, roles("admin", "hr"), async (req, res) => {
  try {
    const { employeeId, month, allowance = 0, deduction = 0 } = req.body;

    if (
      !employeeId ||
      typeof month !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
      return res.status(400).json({
        message: "Employee and month are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    const employee = await User.findOne({
      _id: employeeId,
      role: "employee",
      active: true,
    });

    if (!employee) {
      return res.status(404).json({
        message: "Employee not found.",
      });
    }

    const basicSalary = employee.basicSalary;

    const netSalary = basicSalary + Number(allowance) - Number(deduction);

    if (
      !Number.isFinite(Number(basicSalary)) ||
      Number(basicSalary) < 0 ||
      !Number.isFinite(Number(allowance)) ||
      !Number.isFinite(Number(deduction)) ||
      Number(allowance) < 0 ||
      Number(deduction) < 0 ||
      !Number.isFinite(netSalary) ||
      netSalary < 0
    ) {
      return res.status(400).json({
        message: "Invalid salary values.",
      });
    }

    const payroll = await Payroll.create({
      employee: employee._id,
      month,
      basicSalary,
      allowance: Number(allowance),
      deduction: Number(deduction),
      netSalary,
    });

    res.status(201).json(payroll);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        message: "Payroll already exists for this month.",
      });
    }

    res.status(500).json({
      message: "Could not generate payroll.",
    });
  }
});

app.get("/api/payroll", auth, roles("admin", "hr"), async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("employee", "name email department designation")
      .sort({ createdAt: -1 });

    res.json(payrolls);
  } catch (e) {
    res.status(500).json({
      message: "Could not fetch payroll records.",
    });
  }
});

app.get("/api/payroll/my", auth, roles("employee"), async (req, res) => {
  try {
    const payrolls = await Payroll.find({
      employee: req.user.id,
    })
      .populate("employee", "name email department designation")
      .sort({ month: -1 });

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch(
  "/api/payroll/:id/status",
  auth,
  roles("admin", "hr"),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (!["paid", "pending"].includes(status)) {
        return res.status(400).json({
          message: "Invalid payroll status.",
        });
      }

      const payroll = await Payroll.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true },
      ).populate("employee", "name email department");

      if (!payroll) {
        return res.status(404).json({
          message: "Payroll record not found.",
        });
      }

      res.json({
        success: true,
        message: "Payroll status updated.",
        payroll,
      });
    } catch (e) {
      res.status(500).json({
        message: "Could not update payroll status.",
      });
    }
  },
);

app.get("/api/dashboard", auth, async (req, res) => {
  try {
    const isEmployee = req.user.role === "employee";

    const own = isEmployee ? { employee: req.user.id } : {};

    const [employees, attendance, leaves] = await Promise.all([
      isEmployee
        ? User.countDocuments({ _id: req.user.id })
        : User.countDocuments({ active: true, role: "employee" }),

      Attendance.find({ ...own, day: dayKey() }),

      Leave.find({ ...own, status: "pending" }),
    ]);

    const present = attendance.filter((a) =>
      ["present", "late"].includes(a.status),
    ).length;

    const late = attendance.filter((a) => a.status === "late").length;

    const absent = Math.max(0, employees - present);

    res.json({
      employees,
      present,
      absent,
      late,
      pendingLeaves: leaves.length,
      today: dayKey(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/ai/chat", auth, async (req, res) => {
  // Safe starter fallback. Add a hosted LLM here; keep the provider key on the backend only.
  const q = String(req.body.message || "").toLowerCase();
  const d = await Promise.all([
    User.countDocuments(
      req.user.role === "employee"
        ? { _id: req.user.id }
        : { active: true, role: "employee" },
    ),
    Attendance.countDocuments({
      day: dayKey(),
      status: { $in: ["present", "late"] },
    }),
    Leave.countDocuments({
      status: "pending",
      ...(req.user.role === "employee" ? { employee: req.user.id } : {}),
    }),
  ]);
  let answer = `Current data: ${d[0]} ${req.user.role === "employee" ? "personal account" : "active employees"}, ${d[1]} check-ins today, and ${d[2]} pending leave requests in your permitted scope.`;
  if (q.includes("salary") && req.user.role === "employee")
    answer =
      "I can only show your own payslip; I cannot disclose another employee's salary.";
  else if (q.includes("leave"))
    answer = `There are ${d[2]} pending leave request(s) in your permitted scope. For your remaining leave balance, connect the leave-quota module first.`;
  res.json({
    answer,
    aiGenerated: false,
    note: "MVP data summary; connect a hosted LLM API for full AI features.",
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`HCM Lite API running on port: ${PORT}`);
  });
}

module.exports = app;