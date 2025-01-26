"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export default function SignUpPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [token, setToken] = useState("");
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setIsClient(true);
    }, []);

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const verifyToken = async (inputToken: string) => {
        try {
            const { data, error } = await supabase
                .from('tokengenerate')
                .select('*')
                .eq('token', inputToken);

            if (error) { 
                showToast("Token verification failed. Please try again.");
                return false;
            }

            if (!data || data.length === 0) {
                showToast("Invalid token provided.");
                return false;
            }

            if (data.length > 1) {
                console.warn('Multiple tokens found for the same token value. Using the first one.');
            }

            const tokenData = data[0];

            if (tokenData.status === 'InUse') {
                showToast("Token has already been used.");
                return false;
            } 

            return true;
        } catch (error) {
            showToast("An unexpected error occurred during token verification.");
            return false;
        }
    };

    const associateTokenWithUser = async (token: string, userId: string) => {
        try {
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!username.trim() || !password.trim()) {
            showToast("Username and password cannot be empty.");
            return;
        }

        if (!token.trim()) {
            showToast("Token cannot be empty.");
            return;
        }

        try {
            const isTokenValid = await verifyToken(token);

            if (!isTokenValid) {
                return;
            }

            const { data: userData, error } = await supabase
                .from("users")
                .insert([{ username, password, token }])
                .select()
                .single();

            if (error && error.code === '23505') {
                showToast("Username already taken. Please try a different one.");
                return;
            }

            if (error) {
                showToast("Error: " + (error.message || 'Failed to create user'));
            } else {
                const userId = userData.id;

                await associateTokenWithUser(token, userId);

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
                router.push("/");
            }
        } catch (error) {
            showToast("An unexpected error occurred.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-violet-600 flex items-center justify-center p-4">
            <div className="bg-gray-800/50 backdrop-blur-lg p-8 rounded-xl shadow-xl max-w-md w-full">
                <h1 className="text-3xl font-bold text-white text-center mb-8">
                    Galaxy KickLock SignUp
                </h1>
                {isClient && toastMessage && (
                    <div className="mb-4 p-3 bg-blue-500/20 text-white rounded-lg text-center">
                        {toastMessage}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-white mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter username"
                        />
                    </div>
                    <div>
                        <label className="block text-white mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter password"
                        />
                    </div>
                    <div>
                        <label className="block text-white mb-2">Token</label>
                        <input
                            type="text"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter token"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition duration-200"
                    >
                        Sign Up
                    </button>
                </form>
            </div>
        </div>
    );
}