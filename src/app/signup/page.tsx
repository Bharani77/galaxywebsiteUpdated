"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

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
        if (isLoading) return;
        
        setIsLoading(true);
        try {
            if (!username.trim() || !password.trim()) {
                showToast("Username and password cannot be empty.");
                return;
            }

            if (!token.trim()) {
                showToast("Token cannot be empty.");
                return;
            }

            const isTokenValid = await verifyToken(token);
            if (!isTokenValid) return;

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
                return;
            }

            const userId = userData.id;
            await associateTokenWithUser(token, userId);

            const { error: updateError } = await supabase
                .from('tokengenerate')
                .update({ status: 'InUse' })
                .eq('token', token);
            
            if (updateError) {
                showToast("Error updating token status.");
                return;
            }

            showToast("Signup successful!", 'success');
            setTimeout(() => {
                setUsername("");
                setPassword("");
                setToken("");
                router.push("/signin");
            }, 2000);
        } catch (error) {
            showToast("An unexpected error occurred.");
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