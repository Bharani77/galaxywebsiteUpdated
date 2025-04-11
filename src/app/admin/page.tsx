"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Import Link from next/link
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// Admin session storage keys
const ADMIN_STORAGE_KEYS = {
    ADMIN_ID: 'adminId',
    ADMIN_USERNAME: 'adminUsername',
    ADMIN_SESSION_ID: 'adminSessionId'
};

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    // Check if admin is already logged in
    useEffect(() => {
        const checkAdminSession = async () => {
            try {
                // Check for admin session in localStorage instead of sessionStorage
                const adminId = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_ID);
                const adminUsername = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_USERNAME);
                const adminSessionId = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION_ID);
                
                // If admin session exists, redirect to dashboard
                if (adminId && adminUsername && adminSessionId) {
                    router.push("/admin/dashboard");
                    return;
                }
                
                // Also check Supabase auth session as fallback
                const { data: session } = await supabase.auth.getSession();
                if (session && session.session) {
                    router.push("/admin/dashboard");
                    return;
                }
            } catch (error) {
                console.error("Error checking admin session:", error);
            } finally {
                setLoading(false);
            }
        };
        
        checkAdminSession();
    }, [router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(""); // Clear any previous errors

        try {
            const { data, error } = await supabase
                .from("admin")
                .select("*")
                .eq("username", username)
                .single();

            if (error) {
                console.error("Error querying database:", error);
                setError("An error occurred during login. Please try again.");
                return;
            }

            if (!data) {
                setError("Invalid username or password.");
                return;
            }

            if (data.password !== password) {
                setError("Invalid username or password.");
                return;
            }

            // Store admin session data in localStorage instead of sessionStorage
            const adminSessionId = generateSessionId();
            localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_ID, data.id);
            localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_USERNAME, data.username);
            localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION_ID, adminSessionId);

            // Redirect to dashboard
            router.push("/admin/dashboard");
        } catch (error) {
            console.error("Error:", error);
            setError("An unexpected error occurred.");
        }
    };

    // Generate a unique session ID
    const generateSessionId = (): string => {
        return crypto.randomUUID();
    };

    // Show loading state while checking session
    if (loading) {
        return (
            <div className="welcome-container">
                <div className="auth-card">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="welcome-container">
            <div className="auth-card max-w-md w-full p-8">
                <h1 className="text-center mb-8">
                    <span style={{ 
                        color: '#D32F2F',
                        fontFamily: 'Audiowide, cursive',
                        fontSize: '2rem',
                        textShadow: '0 0 10px rgba(211, 47, 47, 0.3)'
                    }}>
                        KICK ~ LOCK ADMIN
                    </span>
                </h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="input-field"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter admin username"
                        />
                    </div>
                    <div className="form-group">
                        <label className="block text-white text-sm font-semibold mb-2 text-left w-full">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="input-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter admin password"
                        />
                    </div>
                    <button
                        type="submit"
                        className="welcome-button w-full mt-6"
                    >
                        Sign In
                    </button>
                </form>
                {error && (
                    <div className="error-message mt-4">
                        {error}
                    </div>
                )}
                <div className="mt-6 text-center">
                    <Link href="/" className="text-primary-color hover:text-secondary-color transition-colors">
                        Return to Main Page
                    </Link>
                </div>
            </div>
        </div>
    );
}