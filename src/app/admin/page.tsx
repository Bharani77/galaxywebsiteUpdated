"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Import Link from next/link
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export default function AdminLoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

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

            if (data.password !== password) {  // Replace with secure password comparison
                setError("Invalid username or password.");
                return;
            }

            router.push("/admin/dashboard");
        } catch (error) {
            console.error("Error:", error);
            setError("An unexpected error occurred.");
        }
    };

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