import { useState } from "react";

import { useNavigate } from "react-router-dom";

import { motion } from "framer-motion";

import {
  FaHeartbeat,
  FaLock,
  FaEnvelope,
} from "react-icons/fa";

import API from "../../services/api";

export default function Login() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const nav = useNavigate();

  const login = async () => {
    if (loading) return;

    const emailValue =
      email.trim().toLowerCase();

    if (!emailValue || !password) {
      alert(
        "Vui lòng nhập email và mật khẩu."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await API.post(
        "/auth/login",
        {
          email: emailValue,
          password,
        }
      );

      console.log(
        "LOGIN RESPONSE =",
        res.data
      );

      const token =
        res.data?.token;

      const role =
        res.data?.role;

      if (!token) {
        alert(
          "Đăng nhập thất bại: server không trả về token."
        );
        return;
      }

      const userData = {
        id:
          res.data?.id ||
          res.data?._id ||
          "",

        _id:
          res.data?._id ||
          res.data?.id ||
          "",

        username:
          res.data?.username ||
          "",

        fullName:
          res.data?.fullName ||
          "",

        email:
          res.data?.email ||
          emailValue,

        role:
          role || "user",

        // Lưu luôn token trong user
        // để tương thích code cũ
        token,
      };

      // ================================
      // LƯU TOKEN
      // ================================

      localStorage.setItem(
        "token",
        token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(userData)
      );

      console.log(
        "USER SAVED =",
        userData
      );

      if (role === "admin") {
        nav("/admin", {
          replace: true,
        });
      } else if (
        role === "doctor"
      ) {
        nav("/doctor", {
          replace: true,
        });
      } else {
        nav("/dashboard", {
          replace: true,
        });
      }
    } catch (err) {
      console.error(
        "LOGIN ERROR =",
        err
      );

      alert(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Đăng nhập thất bại."
      );
    } finally {
      setLoading(false);
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
          y: 50,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.7,
        }}
      >
        <div className="logo">
          <FaHeartbeat className="logo-icon" />

          <h2>
            DOCTIS
          </h2>
        </div>

        <div className="input-group">
          <FaEnvelope className="input-icon" />

          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                login();
              }
            }}
          />
        </div>

        <div className="input-group">
          <FaLock className="input-icon" />

          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                login();
              }
            }}
          />
        </div>

        <button
          className="btn"
          onClick={login}
          disabled={loading}
        >
          {loading
            ? "Đang đăng nhập..."
            : "Login"}
        </button>

        <div
          className="link"
          onClick={() =>
            nav("/register")
          }
        >
          Chưa có tài khoản?
          {" "}
          Đăng ký
        </div>

        <div
          className="link"
          onClick={() =>
            nav("/forgot")
          }
        >
          Quên mật khẩu?
        </div>
      </motion.div>
    </div>
  );
}
