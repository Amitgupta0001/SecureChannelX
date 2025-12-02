import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  Alert,
  AlertDescription,
  Checkbox,
  Progress,
} from "@/components/ui";

import {
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5050";

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [validation, setValidation] = useState({
    username: { valid: false, message: "", checking: false },
    email: { valid: false, message: "" },
    password: { valid: false, message: "", strength: 0, checks: {} },
    confirmPassword: { valid: false, message: "" },
  });

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const calculatePasswordStrength = (password) => {
    if (!password) return { strength: 0, checks: {} };
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    const strength = Object.values(checks).filter(Boolean).length * 20;
    return { strength, checks };
  };

  // Username availability check (fixed response parsing + trim/encode)
  useEffect(() => {
    let cancelled = false;

    const checkUsername = async () => {
      const raw = formData.username || "";
      const username = raw.trim();

      if (!username) {
        if (!cancelled) {
          setValidation((prev) => ({
            ...prev,
            username: { valid: false, message: "", checking: false },
          }));
        }
        return;
      }

      if (username.length < 3) {
        if (!cancelled) {
          setValidation((prev) => ({
            ...prev,
            username: { valid: false, message: "Username must be at least 3 characters", checking: false },
          }));
        }
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        if (!cancelled) {
          setValidation((prev) => ({
            ...prev,
            username: { valid: false, message: "Only letters, numbers & underscores allowed", checking: false },
          }));
        }
        return;
      }

      setValidation((prev) => ({
        ...prev,
        username: { ...prev.username, checking: true, message: "Checking..." },
      }));

      try {
        const { data } = await axios.get(
          `${API}/api/auth/check-username/${encodeURIComponent(username)}`,
          { timeout: 7000 }
        );

        // Normalize backend shapes:
        // { success, data: { available, message } } OR { available, message }
        const available =
          typeof data?.data?.available !== "undefined"
            ? Boolean(data.data.available)
            : Boolean(data?.available);

        const message =
          data?.data?.message ||
          data?.message ||
          (available ? "Username available ✓" : "Username already taken");

        if (!cancelled) {
          setValidation((prev) => ({
            ...prev,
            username: { valid: available, message, checking: false },
          }));
        }
      } catch {
        if (!cancelled) {
          setValidation((prev) => ({
            ...prev,
            username: { valid: false, message: "Cannot check username right now", checking: false },
          }));
        }
      }
    };

    const timeout = setTimeout(checkUsername, 600);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [formData.username]);

  // Email validation (no message when empty)
  useEffect(() => {
    const email = (formData.email || "").trim();
    if (!email) {
      setValidation((prev) => ({ ...prev, email: { valid: false, message: "" } }));
      return;
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setValidation((prev) => ({
      ...prev,
      email: { valid: regex.test(email), message: regex.test(email) ? "Valid email ✓" : "Invalid email" },
    }));
  }, [formData.email]);

  // Password strength/message (no message when empty)
  useEffect(() => {
    const pwd = formData.password || "";
    if (!pwd) {
      setValidation((prev) => ({
        ...prev,
        password: { valid: false, message: "", strength: 0, checks: {} },
      }));
      return;
    }

    const { strength, checks } = calculatePasswordStrength(pwd);
    let msg = "Weak password";
    let valid = false;

    if (strength >= 80) (msg = "Strong password"), (valid = true);
    else if (strength >= 60) (msg = "Good password"), (valid = true);
    else if (strength >= 40) msg = "Fair password";

    setValidation((prev) => ({
      ...prev,
      password: { valid, message: msg, strength, checks },
    }));
  }, [formData.password]);

  // Confirm password (no message when empty)
  useEffect(() => {
    const pwd = formData.password || "";
    const cpw = formData.confirmPassword || "";
    if (!cpw) {
      setValidation((prev) => ({
        ...prev,
        confirmPassword: { valid: false, message: "" },
      }));
      return;
    }
    const ok = pwd === cpw;
    setValidation((prev) => ({
      ...prev,
      confirmPassword: { valid: ok, message: ok ? "Passwords match ✓" : "Passwords do not match" },
    }));
  }, [formData.password, formData.confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validation.username.valid) return setError("Enter a valid username");
    if (!validation.email.valid) return setError("Enter a valid email");
    if (!validation.password.valid) return setError("Weak password");
    if (!validation.confirmPassword.valid) return setError("Passwords do not match");
    if (!acceptedTerms) return setError("Please accept the terms");

    setLoading(true);
    try {
      const res = await registerUser(
        formData.username.trim(),
        formData.email.trim(),
        formData.password
      );

      if (res.success) {
        setSuccess(res.message || "Registration successful");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setError(res.error || "Registration failed");
      }
    } catch {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1f2937] to-[#111827] p-6">
      <Card className="w-full max-w-lg bg-white/15 backdrop-blur-2xl border border-white/25 shadow-2xl rounded-3xl px-6 py-8">
        <CardHeader className="text-center space-y-2">
          <Shield className="h-14 w-14 text-indigo-400 drop-shadow-xl mx-auto" />
          <CardTitle className="text-3xl font-bold text-white tracking-wide">Create Account</CardTitle>
          <CardDescription className="text-gray-200">Join SecureChannelX for encrypted messaging</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <Alert className="bg-red-500/20 border border-red-400/30 text-red-300 rounded-xl">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-500/20 border border-green-400 text-green-300 rounded-xl">
                <CheckCircle2 className="h-5 w-5" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Username */}
            <div className="space-y-1">
              <Label className="text-gray-200">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  name="username"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pl-12 bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-xl"
                />
                <span className="absolute right-3 top-3">
                  {validation.username.checking ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                  ) : validation.username.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : formData.username ? (
                    <XCircle className="h-5 w-5 text-red-400" />
                  ) : null}
                </span>
              </div>
              {formData.username && (
                <p className={`text-xs ${validation.username.valid ? "text-green-300" : "text-red-300"}`}>
                  {validation.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label className="text-gray-200">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  name="email"
                  placeholder="Enter email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-12 bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-xl"
                />
                {formData.email && (
                  <span className="absolute right-3 top-3">
                    {validation.email.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400" />
                    )}
                  </span>
                )}
              </div>
              {formData.email && (
                <p className={`text-xs ${validation.email.valid ? "text-green-300" : "text-red-300"}`}>
                  {validation.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label className="text-gray-200">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-12 bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-300" /> : <Eye className="h-5 w-5 text-gray-300" />}
                </button>
              </div>

              {formData.password && (
                <>
                  <div className="flex justify-between text-xs text-gray-200 mt-1">
                    <span>Password Strength</span>
                    <span className={validation.password.valid ? "text-green-400" : "text-red-300"}>
                      {validation.password.message}
                    </span>
                  </div>
                  <Progress value={validation.password.strength} />
                  <div className="grid grid-cols-2 text-xs text-gray-300 gap-1 mt-1">
                    <span className={validation.password.checks.length ? "text-green-300" : ""}>✓ 8+ characters</span>
                    <span className={validation.password.checks.uppercase ? "text-green-300" : ""}>✓ Uppercase</span>
                    <span className={validation.password.checks.lowercase ? "text-green-300" : ""}>✓ Lowercase</span>
                    <span className={validation.password.checks.number ? "text-green-300" : ""}>✓ Number</span>
                    <span className={validation.password.checks.special ? "text-green-300" : ""}>✓ Special</span>
                  </div>
                </>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <Label className="text-gray-200">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-12 bg-white/20 text-white placeholder-gray-300 border border-white/30 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-300" /> : <Eye className="h-5 w-5 text-gray-300" />}
                </button>
              </div>
              {formData.confirmPassword && (
                <p className={`text-xs ${validation.confirmPassword.valid ? "text-green-300" : "text-red-300"}`}>
                  {validation.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 mt-3">
              <Checkbox checked={acceptedTerms} onCheckedChange={setAcceptedTerms} />
              <p className="text-gray-200 text-sm">
                I agree to the{" "}
                <Link className="text-indigo-300 underline" to="/terms">
                  Terms
                </Link>{" "}
                and{" "}
                <Link className="text-indigo-300 underline" to="/privacy">
                  Privacy Policy
                </Link>
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl py-3 shadow-xl hover:shadow-2xl hover:scale-[1.01] transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center py-6">
          <p className="text-gray-200">
            Already have an account?{" "}
            <Link className="text-indigo-300 underline" to="/login">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Register;