"use client";

import React, { useState } from "react"; // Removed useEffect as it's not used
import { useRouter } from "next/navigation";
// import { createClient } from "@supabase/supabase-js"; // Supabase client no longer needed here
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // No longer needed
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer needed
// const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // No longer needed

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const showToast = (message: string, type: 'success' | 'error' = 'error') => {
        toast[type](message, {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark"
        });
    };

    // verifyToken, associateTokenWithUser, and direct DB calls for user/token updates
    // are now handled by the /api/auth/signup backend route.

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            if (!username.trim() || !password.trim()) {
                showToast("Username and password cannot be empty.");
                setIsLoading(false);
                return;
            }

            // Add username validation: alphanumeric only, no spaces or special characters
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(username)) {
                showToast("Username can only contain alphanumeric characters (A-Z, a-z, 0-9) and no spaces or special characters.");
                setIsLoading(false);
                return;
            }

            // Add password validation
            if (password.length < 8) {
                showToast("Password must be at least 8 characters long.");
                setIsLoading(false);
                return;
            }

            if (!token.trim()) {
                showToast("Token cannot be empty.");
                setIsLoading(false);
                return;
            }

            // Call the backend API for signup
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, token }),
            });

            const data = await response.json();

            if (response.ok) { // Status 201 Created is also response.ok
                showToast(data.message || "Signup successful!", 'success');
                setTimeout(() => {
                    setUsername("");
                    setPassword("");
                    setToken("");
                    router.push("/signin");
                }, 2000);
            } else {
                showToast(data.message || "Signup failed. Please try again.");
            }
        } catch (error) {
            console.error("Signup error:", error);
            showToast("An unexpected error occurred during signup.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="welcome-container">
            <ToastContainer />
            <div className="auth-card max-w-md w-full p-8">
                <h1 className="text-center mb-8">
                    <span style={{ 
                        color: '#D32F2F',
                        fontFamily: 'Audiowide, cursive',
                        fontSize: '2rem',
                        textShadow: '0 0 10px rgba(211, 47, 47, 0.3)'
                    }}>
                        KICK ~ LOCK
                    </span>
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="input-field"
                            placeholder="Enter username"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="Enter password"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Token
                        </label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="input-field"
                            placeholder="Enter token"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="welcome-button w-full mt-6"
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing up..." : "Sign Up"}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/signin" className="text-primary-color hover:text-secondary-color transition-colors">
                        Already have an account? Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
