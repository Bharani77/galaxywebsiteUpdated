"use client";

import { useSearchParams, useRouter } from "next/navigation";
import React, { Suspense, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GalaxyForm from './GalaxyForm';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlUsername = searchParams.get("username");
    
    const validateSession = async () => {
        let userId: string | null = null;
        let sessionId: string | null = null;
        let storedUsername: string | null = null;
        
        try {
            userId = sessionStorage.getItem("userId");
            sessionId = sessionStorage.getItem("sessionId");
            storedUsername = sessionStorage.getItem("username");
        } catch {
            router.push('/signin');
            return;
        }

        // First validate if URL username matches stored username
        if (urlUsername !== storedUsername) {
            sessionStorage.clear();
            toast.error('Invalid URL. Redirecting to signin...');
            router.push('/signin');
            return;
        }

        if (!userId || !sessionId) {
            sessionStorage.clear();
            router.push('/signin');
            return;
        }

        // Validate against database
        const { data: user, error } = await supabase
            .from("users")
            .select("id, username, active_session_id, token")
            .eq("id", userId)
            .single();

        // Handle user not found or database error
        if (error?.code === 'PGRST116' || !user) {
            // User doesn't exist anymore
            await handleUserRemoval(storedUsername);
            return;
        }

        if (error) {
            toast.error('Session validation failed');
            router.push('/signin');
            return;
        }

        // Check if token still exists and is valid
        const { data: tokenData, error: tokenError } = await supabase
            .from('tokengenerate')
            .select('status')
            .eq('token', user.token)
            .single();

        if (tokenError || !tokenData) {
            // Token doesn't exist or is invalid
            await handleUserRemoval(storedUsername);
            return;
        }

        if (!user || user.active_session_id !== sessionId || user.username !== urlUsername) {
            sessionStorage.clear();
            router.push('/signin');
            toast.error('Session expired. Please sign in again.');
            return;
        }
    };

    const handleUserRemoval = async (username: string | null) => {
        if (username) {
            try {
                // Attempt to undeploy
                await fetch('https://buddymaster77hugs-gradio.hf.space/api/undeploy', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        modal_name: username
                    })
                });
            } catch {
                // Silently handle undeploy error
            }
        }
        sessionStorage.clear();
        toast.error('User access has been revoked');
        router.push('/signin');
    };

    useEffect(() => {
        if (!urlUsername) {
            toast.error('Invalid URL. Redirecting to signin...');
            router.push('/signin');
            return;
        }

        validateSession();
        
        // Validate session every 5 seconds
        const interval = setInterval(validateSession, 5000);

        return () => clearInterval(interval);
    }, [router, urlUsername]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 relative"> {/* Removed background gradient, will use global body background */}
            {/* Logout button removed, handled by GalaxyForm component */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            <GalaxyForm />
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center"> {/* Removed background gradient for fallback */}
                <div className="text-white text-xl">Loading...</div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}