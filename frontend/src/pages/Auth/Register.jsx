import { useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  FaEnvelope,
  FaLock,
  FaUser,
  FaIdCard,
  FaHeartbeat
} from "react-icons/fa";

import { motion } from "framer-motion";

import API from "../../services/api";

export default function Register() {

  const nav = useNavigate();

  const [form, setForm] = useState({
    cccd: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const change = (e) => {

    setForm({
      ...form,
      [e.target.name]:
        e.target.value
    });

  };

  const register = async () => {

    try {

      const res = await API.post(
        "/auth/register",
        form
      );

      alert(res.data.msg);

      nav("/");

    } catch (err) {

      alert(
        err.response?.data?.msg
      );

    }
  };

  return (
    <div className="auth-container">

      <div className="circle"></div>
      <div className="circle"></div>
      <div className="circle"></div>

      <motion.div
        className="auth-card"
        initial={{
          opacity: 0,
          y: 50
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
      >

        <div className="logo">
          <FaHeartbeat className="logo-icon" />
          <h2>DOCTIS</h2>
        </div>

        <h3 className="title">
          Register
        </h3>

        <div className="input-group">
          <FaIdCard className="input-icon" />

          <input
            className="input"
            placeholder="CCCD"
            name="cccd"
            onChange={change}
          />
        </div>

        <div className="input-group">
          <FaUser className="input-icon" />

          <input
            className="input"
            placeholder="Username"
            name="username"
            onChange={change}
          />
        </div>

        <div className="input-group">
          <FaEnvelope className="input-icon" />

          <input
            className="input"
            placeholder="Email"
            name="email"
            onChange={change}
          />
        </div>

        <div className="input-group">
          <FaLock className="input-icon" />

          <input
            type="password"
            className="input"
            placeholder="Password"
            name="password"
            onChange={change}
          />
        </div>

        <div className="input-group">
          <FaLock className="input-icon" />

          <input
            type="password"
            className="input"
            placeholder="Confirm Password"
            name="confirmPassword"
            onChange={change}
          />
        </div>

        <button
          className="btn"
          onClick={register}
        >
          Register
        </button>

        <div
          className="link"
          onClick={() => nav("/")}
        >
          Đã có tài khoản? Login
        </div>

      </motion.div>
    </div>
  );
}
