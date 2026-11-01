import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Bot,
  LogOut,
  Plus,
  Check,
  X,
  Clock3,
  Building2,
} from "lucide-react";
import "./style.css";
import { jsPDF } from "jspdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
function App() {
  const [token, setToken] = useState(localStorage.getItem("hcm_token") || "");
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("hcm_user") || "null"),
  );
  const [payrollForm, setPayrollForm] = useState({
    employeeId: "",
    month: "",
    allowance: 0,
    deduction: 0,
  });
  const [email, setEmail] = useState("admin@example.com"),
    [password, setPassword] = useState("ChangeMe123!");
  const [page, setPage] = useState("Dashboard"),
    [data, setData] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [employees, setEmployees] = useState([]),
    [leaves, setLeaves] = useState([]),
    [attendance, setAttendance] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [showEmployee, setShowEmployee] = useState(false),
    [emp, setEmp] = useState({
      name: "",
      email: "",
      password: "TempPass123!",
      department: "Engineering",
      designation: "Developer",
      basicSalary: 50000,
    });
  const [leave, setLeave] = useState({
      type: "casual",
      startDate: "",
      endDate: "",
      reason: "",
    }),
    [chat, setChat] = useState("Who is on leave today?"),
    [answer, setAnswer] = useState("");
  async function api(path, options = {}) {
    const r = await fetch(API + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.message || "Request failed");
    return body;
  }
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      setUser(result.user);
      localStorage.setItem("hcm_token", result.token);
      localStorage.setItem("hcm_user", JSON.stringify(result.user));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function logout() {
    localStorage.removeItem("hcm_token");
    localStorage.removeItem("hcm_user");
    setToken("");
    setUser(null);
    setData({});
  }
  async function refresh() {
    if (!token) return;
    try {
      const dash = await api("/dashboard");
      setData(dash);
      if (user?.role !== "employee") setEmployees(await api("/employees"));
      if (user?.role !== "employee") {
        setPayrolls(await api("/payroll"));
      }
      setLeaves(await api("/leaves"));
      setAttendance(await api("/attendance"));
      if (user?.role === "employee") {
        setMyPayrolls(await api("/payroll/my"));
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, [token, user?.role]);
  async function createEmployee(e) {
    e.preventDefault();
    try {
      await api("/employees", { method: "POST", body: JSON.stringify(emp) });
      setShowEmployee(false);
      setEmp({
        name: "",
        email: "",
        password: "TempPass123!",
        department: "Engineering",
        designation: "Developer",
        basicSalary: 50000,
      });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  async function submitLeave(e) {
    e.preventDefault();
    try {
      await api("/leaves", { method: "POST", body: JSON.stringify(leave) });
      setLeave({ type: "casual", startDate: "", endDate: "", reason: "" });
      refresh();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function review(id, status) {
    try {
      await api(`/leaves/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function createPayroll(e) {
    e.preventDefault();

    try {
      await api("/payroll", {
        method: "POST",
        body: JSON.stringify(payrollForm),
      });

      setPayrollForm({
        employeeId: "",
        month: "",
        allowance: 0,
        deduction: 0,
      });

      setError("");
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function updatePayrollStatus(id, status) {
    try {
      await api(`/payroll/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      refresh();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function ask(e) {
    e.preventDefault();
    try {
      const r = await api("/ai/chat", {
        method: "POST",
        body: JSON.stringify({ message: chat }),
      });
      setAnswer(r.answer);
    } catch (e) {
      setError(e.message);
    }
  }
  async function attendanceAction(action) {
    try {
      await api(`/attendance/${action}`, { method: "POST", body: "{}" });
      refresh();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  if (!token)
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand-mark">
            <Building2 size={26} />
          </div>
          <p className="eyebrow">HUMAN CAPITAL MANAGEMENT</p>
          <h1>Welcome to HCM Lite</h1>
          <p className="muted">
            Your people, attendance and leave — all in one place.
          </p>
          {error && <div className="error">{error}</div>}
          <form onSubmit={login}>
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="primary full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="hint">
            First run uses ADMIN_EMAIL and ADMIN_PASSWORD from backend/.env.
          </p>
        </div>
      </div>
    );
  const nav = [
    ["Dashboard", LayoutDashboard],
    ...(user.role !== "employee"
      ? [
          ["Employees", Users],
          ["Payroll", Building2],
        ]
      : [["My Payroll", Building2]]),
    ["Attendance", CalendarCheck],
    ["Leave", CalendarDays],
    ["AI Assistant", Bot],
  ];

  function downloadPayslip(p) {
    const doc = new jsPDF();
    const employee = p.employee || {};

    doc.setFontSize(20);
    doc.text("HCM Lite - Salary Payslip", 20, 20);

    doc.setFontSize(12);
    doc.text(`Employee: ${employee.name || "N/A"}`, 20, 40);
    doc.text(`Email: ${employee.email || "N/A"}`, 20, 50);
    doc.text(`Department: ${employee.department || "N/A"}`, 20, 60);
    doc.text(`Designation: ${employee.designation || "N/A"}`, 20, 70);
    doc.text(`Payroll Month: ${p.month}`, 20, 85);

    doc.text(`Basic Salary: Rs. ${p.basicSalary}`, 20, 105);
    doc.text(`Allowance: Rs. ${p.allowance}`, 20, 115);
    doc.text(`Deduction: Rs. ${p.deduction}`, 20, 125);

    doc.setFontSize(15);
    doc.text(`Net Salary: Rs. ${p.netSalary}`, 20, 145);

    doc.setFontSize(12);
    doc.text(`Payment Status: ${p.status}`, 20, 160);

    doc.save(`Payslip-${p.month}.pdf`);
  }

  const attendanceChartData = [
    { name: "Present", count: data.present || 0 },
    { name: "Absent", count: data.absent || 0 },
    { name: "Late", count: data.late || 0 },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark small">
            <Building2 size={20} />
          </span>
          <div>
            <b>HCM Lite</b>
            <small>People operations</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(([label, Icon]) => (
          <button
            key={label}
            className={"nav-item " + (page === label ? "active" : "")}
            onClick={() => setPage(label)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="avatar">{user.name?.[0] || "U"}</div>
          <div className="profile">
            <b>{user.name}</b>
            <small>{user.role}</small>
          </div>
          <button className="icon-btn" onClick={logout} title="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="muted">Workspace / </span>
            <b>{page}</b>
          </div>
          <span className="role-pill">{user.role}</span>
        </header>
        <section className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>
                {page === "Dashboard"
                  ? "Good day, " + user.name.split(" ")[0]
                  : page}
              </h1>
              <p className="muted">
                {page === "Dashboard"
                  ? "Here’s what’s happening in your workplace today."
                  : "Manage your workplace activity from one place."}
              </p>
            </div>
            <span className="date-pill">
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {error && (
            <div className="error" onClick={() => setError("")}>
              {error}　×
            </div>
          )}
          {page === "Dashboard" && (
            <>
              <div className="stats">
                <Stat
                  icon={Users}
                  label={user.role === "employee" ? "My account" : "Employees"}
                  value={data.employees ?? "—"}
                  tone="blue"
                />
                <Stat
                  icon={CalendarCheck}
                  label="Present today"
                  value={data.present ?? "—"}
                  tone="green"
                />
                <Stat
                  icon={Clock3}
                  label="Late today"
                  value={data.late ?? "—"}
                  tone="orange"
                />
                <Stat
                  icon={CalendarDays}
                  label="Pending leave"
                  value={data.pendingLeaves ?? "—"}
                  tone="purple"
                />

                <Stat
                  icon={Users}
                  label="Absent today"
                  value={data.absent ?? "—"}
                  tone="orange"
                />
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Attendance Overview</h3>
                    <p className="muted">Today's attendance summary</p>
                  </div>
                </div>

                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceChartData}>
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid-two">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Recent attendance</h3>
                      <p className="muted">Latest check-in records</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("Attendance")}
                    >
                      View all
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.slice(0, 5).map((a) => (
                          <tr key={a._id}>
                            <td>{a.employee?.name || user.name}</td>
                            <td>{a.day}</td>
                            <td>
                              <span className={"status " + a.status}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!attendance.length && (
                          <tr>
                            <td colSpan="3" className="empty">
                              No attendance records yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Leave requests</h3>
                      <p className="muted">Latest requests</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => setPage("Leave")}
                    >
                      View all
                    </button>
                  </div>

                  {leaves.slice(0, 4).map((l) => (
                    <div className="leave-row" key={l._id}>
                      <div className="leave-icon">
                        <CalendarDays size={17} />
                      </div>
                      <div className="leave-info">
                        <b>
                          {l.employee?.name || "My leave"} · {l.type}
                        </b>
                        <small>
                          {l.startDate} — {l.endDate}
                        </small>
                      </div>
                      <span className={"status " + l.status}>{l.status}</span>
                    </div>
                  ))}

                  {!leaves.length && (
                    <p className="empty">No leave requests yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
          {page === "Employees" && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Employee directory</h3>
                  <p className="muted">{employees.length} active records</p>
                </div>
                <button
                  className="primary"
                  onClick={() => setShowEmployee(!showEmployee)}
                >
                  <Plus size={16} /> Add employee
                </button>
              </div>
              {showEmployee && (
                <form className="form-grid" onSubmit={createEmployee}>
                  {[
                    ["name", "Full name"],
                    ["email", "Email"],
                    ["password", "Temporary password"],
                    ["department", "Department"],
                    ["designation", "Designation"],
                    ["basicSalary", "Basic salary"],
                  ].map(([k, l]) => (
                    <label key={k}>
                      {l}
                      <input
                        type={
                          k === "email"
                            ? "email"
                            : k === "basicSalary"
                              ? "number"
                              : "text"
                        }
                        value={emp[k]}
                        onChange={(e) =>
                          setEmp({ ...emp, [k]: e.target.value })
                        }
                        required
                      />
                    </label>
                  ))}
                  <button className="primary">Create employee</button>
                </form>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e._id}>
                        <td>
                          <b>{e.name}</b>
                        </td>
                        <td>{e.email}</td>
                        <td>{e.department || "—"}</td>
                        <td>{e.designation || "—"}</td>
                        <td>
                          <span className="role-pill">{e.role}</span>
                        </td>
                      </tr>
                    ))}
                    {!employees.length && (
                      <tr>
                        <td colSpan="5" className="empty">
                          Add your first employee to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {page === "Attendance" && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Attendance</h3>
                  <p className="muted">Server-stamped check-in and check-out</p>
                </div>
                {user.role === "employee" && (
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() => attendanceAction("check-in")}
                    >
                      Check in
                    </button>
                    <button
                      className="secondary"
                      onClick={() => attendanceAction("check-out")}
                    >
                      Check out
                    </button>
                  </div>
                )}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Check in</th>
                      <th>Check out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a._id}>
                        <td>{a.employee?.name || user.name}</td>
                        <td>{a.day}</td>
                        <td>
                          {a.checkIn
                            ? new Date(a.checkIn).toLocaleTimeString()
                            : "—"}
                        </td>
                        <td>
                          {a.checkOut
                            ? new Date(a.checkOut).toLocaleTimeString()
                            : "—"}
                        </td>
                        <td>
                          <span className={"status " + a.status}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!attendance.length && (
                      <tr>
                        <td colSpan="5" className="empty">
                          No attendance yet. Employees can check in from here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {page === "Leave" && (
            <div className="grid-two">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Request leave</h3>
                    <p className="muted">Submit a request for review</p>
                  </div>
                </div>
                <form className="stack-form" onSubmit={submitLeave}>
                  <label>
                    Leave type
                    <select
                      value={leave.type}
                      onChange={(e) =>
                        setLeave({ ...leave, type: e.target.value })
                      }
                    >
                      <option value="casual">Casual</option>
                      <option value="sick">Sick</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </label>
                  <label>
                    Start date
                    <input
                      type="date"
                      value={leave.startDate}
                      onChange={(e) =>
                        setLeave({ ...leave, startDate: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    End date
                    <input
                      type="date"
                      value={leave.endDate}
                      onChange={(e) =>
                        setLeave({ ...leave, endDate: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Reason
                    <textarea
                      value={leave.reason}
                      onChange={(e) =>
                        setLeave({ ...leave, reason: e.target.value })
                      }
                      required
                      rows="3"
                      placeholder="Briefly explain your request"
                    />
                  </label>
                  <button className="primary">Submit request</button>
                </form>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Leave requests</h3>
                    <p className="muted">Review and track status</p>
                  </div>
                </div>
                {leaves.map((l) => (
                  <div className="leave-row" key={l._id}>
                    <div className="leave-info">
                      <b>
                        {l.employee?.name || "My leave"} · {l.type}
                      </b>
                      <small>
                        {l.startDate} — {l.endDate} · {l.reason}
                      </small>
                      <span className={"status " + l.status}>{l.status}</span>
                    </div>
                    {["admin", "hr"].includes(user.role) &&
                      l.status === "pending" && (
                        <div className="actions">
                          <button
                            className="approve"
                            onClick={() => review(l._id, "approved")}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            className="reject"
                            onClick={() => review(l._id, "rejected")}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                  </div>
                ))}
                {!leaves.length && <p className="empty">No requests yet.</p>}
              </div>
            </div>
          )}

          {page === "Payroll" && (
            <div className="grid-two">
              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Generate Payroll</h3>
                    <p className="muted">Create monthly employee salary</p>
                  </div>
                </div>

                <form className="stack-form" onSubmit={createPayroll}>
                  <label>
                    Employee
                    <select
                      value={payrollForm.employeeId}
                      onChange={(e) =>
                        setPayrollForm({
                          ...payrollForm,
                          employeeId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Payroll Month
                    <input
                      type="month"
                      value={payrollForm.month}
                      onChange={(e) =>
                        setPayrollForm({
                          ...payrollForm,
                          month: e.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Allowance
                    <input
                      type="number"
                      min="0"
                      value={payrollForm.allowance}
                      onChange={(e) =>
                        setPayrollForm({
                          ...payrollForm,
                          allowance: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Deduction
                    <input
                      type="number"
                      min="0"
                      value={payrollForm.deduction}
                      onChange={(e) =>
                        setPayrollForm({
                          ...payrollForm,
                          deduction: e.target.value,
                        })
                      }
                    />
                  </label>

                  <button className="primary">Generate Payroll</button>
                </form>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Payroll Records</h3>
                    <p className="muted">{payrolls.length} salary records</p>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Month</th>
                        <th>Net Salary</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {payrolls.map((p) => (
                        <tr key={p._id}>
                          <td>{p.employee?.name}</td>
                          <td>{p.month}</td>
                          <td>Rs. {p.netSalary?.toLocaleString()}</td>
                          <td>
                            <span className={"status " + p.status}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() =>
                                updatePayrollStatus(
                                  p._id,
                                  p.status === "paid" ? "pending" : "paid",
                                )
                              }
                            >
                              Mark {p.status === "paid" ? "Pending" : "Paid"}
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!payrolls.length && (
                        <tr>
                          <td colSpan="5" className="empty">
                            No payroll records yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {page === "My Payroll" && (
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>My Salary Records</h3>
                  <p className="muted">View your monthly salary details</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Basic Salary</th>
                      <th>Allowance</th>
                      <th>Deduction</th>
                      <th>Net Salary</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myPayrolls.map((p) => (
                      <tr key={p._id}>
                        <td>{p.month}</td>
                        <td>Rs. {p.basicSalary?.toLocaleString()}</td>
                        <td>Rs. {p.allowance?.toLocaleString()}</td>
                        <td>Rs. {p.deduction?.toLocaleString()}</td>
                        <td>Rs. {p.netSalary?.toLocaleString()}</td>
                        <td>{p.status}</td>
                        <td>
                          <button
                            className="secondary"
                            onClick={() => downloadPayslip(p)}
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!myPayrolls.length && (
                      <tr>
                        <td colSpan="7" className="empty">
                          No salary records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === "AI Assistant" && (
            <div className="panel ai-panel">
              <div className="ai-hero">
                <div className="ai-icon">
                  <Bot size={26} />
                </div>
                <div>
                  <h3>HCM AI Assistant</h3>
                  <p className="muted">
                    Ask a question about the data available to your role.
                  </p>
                </div>
              </div>
              <div className="suggestions">
                {[
                  "Who is on leave today?",
                  "Summarize today's attendance",
                  "How many leave requests are pending?",
                ].map((s) => (
                  <button
                    key={s}
                    className="suggestion"
                    onClick={() => setChat(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form className="chat-form" onSubmit={ask}>
                <input
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="Ask your HR assistant..."
                  required
                />
                <button className="primary">Ask AI</button>
              </form>
              {answer && (
                <div className="answer">
                  <span className="status">MVP RESPONSE</span>
                  <p>{answer}</p>
                  <small>
                    AI integration is a placeholder; answers are generated from
                    current database counts.
                  </small>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className="stat-card">
      <div className={"stat-icon " + tone}>
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
