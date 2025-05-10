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
            const response = await fetch('/api/admin/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const responseData = await response.json();

            if (response.ok) {
                // Store admin session data in localStorage
                localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_ID, responseData.adminId);
                localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_USERNAME, responseData.adminUsername);
                localStorage.setItem(ADMIN_STORAGE_KEYS.ADMIN_SESSION_ID, responseData.adminSessionId);
                
                // Redirect to dashboard
                router.push("/admin/dashboard");
            } else {
                setError(responseData.message || "Login failed. Please try again.");
            }
        } catch (error) {
            console.error("Login API call error:", error);
            setError("An unexpected error occurred. Please check your connection.");
        }
    };

    // generateSessionId is now handled by the backend.

    // Show loading state while checking session
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
                <div className="bg-gray-800 p-8 rounded-lg shadow-md w-96 text-center">
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg shadow-md w-96">
                <h2 className="text-2xl font-bold mb-4 text-center">
                    Admin Login
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label
                            htmlFor="username"
                            className="block text-gray-400 text-sm font-bold mb-2"
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            htmlFor="password"
                            className="block text-gray-400 text-sm font-bold mb-2"
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    >
                        Sign In
                    </button>
                </form>
                {error && (
                    <div className="text-red-500 text-sm mt-2">
                        {error}
                    </div>
                )}
                <div className="mt-4 text-center">
                    <p className="text-gray-400 text-sm">
                        Not an admin?{" "}
                        <Link
                            href="/"
                            className="text-purple-500 hover:underline"
                        >
                            Go back to the main page
                        </Link>
                    </p>
                </div>
                <div className="mt-4 text-center">
                    <p className="text-gray-400 text-sm">
                        Forgot Password?{" "}
                        {/* Add a link for password reset here */}
                    </p>
                </div>
            </div>
        </div>
    );
}
