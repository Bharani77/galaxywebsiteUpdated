"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false); // Track if the component is on the client
    const router = useRouter();

    // Use useEffect to set isClient to true after component mounts
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Show toast message
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000); // Hide toast after 3 seconds
    };

    // Verify the token
    const verifyToken = async (inputToken: string) => {
        try {
            // Query the tokengenerate table to check if the provided token exists and is valid
            const { data, error } = await supabase
                .from('tokengenerate')
                .select('*')
                .eq('token', inputToken);

            if (error) { 
                showToast("Token verification failed. Please try again.");
                return false;
            }

            // If no rows are found, the token is invalid
            if (!data || data.length === 0) {
                showToast("Invalid token provided.");
                return false;
            }

            // If multiple rows are found, log a warning and use the first row
            if (data.length > 1) {
                console.warn('Multiple tokens found for the same token value. Using the first one.');
            }

            const tokenData = data[0]; // Use the first row

            if (tokenData.status === 'InUse') {
                showToast("Token has already been used.");
                return false;
            } 

            // Optional: Check if token is expired
            // if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
            //     showToast("Token has expired.");
            //     return false;
            // }

            return true;
        } catch (error) {
            showToast("An unexpected error occurred during token verification.");
            return false;
        }
    };

    // Associate the token with the user
    const associateTokenWithUser = async (token: string, userId: string) => {
        try {
            // Update the tokengenerate table to set the userid for the provided token
            const { error } = await supabase
                .from('tokengenerate')
                .update({ userid: userId })
                .eq('token', token)
                .select();

            if (error) {
                showToast("Error associating token with user.");
                return;
            }
        } catch (error) {
            showToast("Error associating token with user.");
        }
    };

    // Handle form submission
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        // Validate username and password
        if (!username.trim() || !password.trim()) {
            showToast("Username and password cannot be empty.");
            return;
        }

        // Validate token
        if (!token.trim()) {
            showToast("Token cannot be empty.");
            return;
        }

        try {
            // First verify the token
            const isTokenValid = await verifyToken(token);

            if (!isTokenValid) {
                return; // Toast message is already shown in verifyToken
            }

            // If token is valid, proceed with user creation
            const { data: userData, error } = await supabase
                .from("users")
                .insert([{ username, password, token }])
                .select()
                .single(); // Use .single() to get a single row result

            if (error && error.code === '23505') { 
                // Check for unique constraint violation (username already exists)
                showToast("Username already taken. Please try a different one.");
                return;
            }

            if (error) {
                showToast("Error: " + (error.message || 'Failed to create user'));
            } else {
                const userId = userData.id;

                // Associate the token with the user
                await associateTokenWithUser(token, userId);

                // Update token status to 'InUse' after successful signup
                const { error: updateError } = await supabase
                    .from('tokengenerate')
                    .update({ status: 'InUse' })
                    .eq('token', token);
                
                if (updateError) {
                    showToast("Error updating token status.");
                }

                showToast("Signup successful!");
                setUsername("");
                setPassword("");
                setToken("");
                router.push("/"); // Redirect to home page
            }
        } catch (error) {
            showToast("An unexpected error occurred.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg shadow-md w-96">
                <h1 className="text-3xl font-bold text-white mb-4 text-center">
                    Sign Up
                </h1>
                {/* Toast Notification (only render on the client) */}
                {isClient && toastMessage && (
                    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
                        toastMessage.includes("Error") || toastMessage.includes("Invalid") || toastMessage.includes("empty")
                            ? "bg-red-600"
                            : "bg-green-600"
                    } text-white`}>
                        {toastMessage}
                    </div>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="username" className="block text-white text-sm font-bold mb-2">
                            Username:
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-white text-sm font-bold mb-2">
                            Password:
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="token" className="block text-white text-sm font-bold mb-2">
                            Token:
                        </label>
                        <input
                            type="text"
                            id="token"
                            name="token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                    >
                        Sign Up
                    </button>
                </form>
            </div>
        </div>
    );
}