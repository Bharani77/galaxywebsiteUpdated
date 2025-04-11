"use client"; // Add this line at the top of the file

import { createClient } from '@supabase/supabase-js';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add admin storage keys
const ADMIN_STORAGE_KEYS = {
    ADMIN_ID: 'adminId',
    ADMIN_USERNAME: 'adminUsername',
    ADMIN_SESSION_ID: 'adminSessionId'
};

interface TokenUser {
    token: string;
    duration: string;
    createdat: string;
    expiresat: string | null;
    username: string;
    userId: string | null;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    
    // Add state for admin name
    const [adminName, setAdminName] = useState<string>('');
    
    // Add logout function
    const handleLogout = () => {
        // Clear admin session data from localStorage
        Object.values(ADMIN_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        
        // Broadcast logout event to other tabs
        localStorage.setItem('admin_logout_event', Date.now().toString());
        
        // Redirect to admin login page
        router.push('/admin');
    };
    
    const [tokens, setTokens] = useState<{ [key: string]: string }>({
        '3month': '',
        '6month': '',
        '1year': '',
    });
    
    const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({
        '3month': false,
        '6month': false,
        '1year': false,
    });
    
    const [isDeletingToken, setIsDeletingToken] = useState<{ [key: string]: { [tokenId: string]: boolean } }>({
        '3month': {},
        '6month': {},
        '1year': {},
    });
    
    const [tokenHistory, setTokenHistory] = useState<{ [key: string]: { token: string; status: string; id: string }[] }>({
        '3month': [],
        '6month': [],
        '1year': [],
    });
    
    const [tokenUsers, setTokenUsers] = useState<TokenUser[]>([]);
    const [isRenewModalOpen, setIsRenewModalOpen] = useState<boolean>(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<string>('3month');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [selectedUserForDelete, setSelectedUserForDelete] = useState<{ userId: string; token: string } | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    
    // Add effect to get admin name from localStorage
    useEffect(() => {
        const username = localStorage.getItem(ADMIN_STORAGE_KEYS.ADMIN_USERNAME);
        if (username) {
            setAdminName(username);
        }
    }, []);
    
    // Add listener for logout events from other tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'admin_logout_event') {
                // Another tab triggered logout, redirect to login page
                router.push('/admin');
            }
        };
        
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [router]);
    
    const MAX_HISTORY_LENGTH = 5;
    
    // Show toast message
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000); // Hide toast after 3 seconds
    };

    // Function to copy token to clipboard
    const copyTokenToClipboard = (token: string) => {
        navigator.clipboard.writeText(token).then(() => {
            showToast('Token copied to clipboard!');
        });
    };

    // Function to update active tokens from history
    const updateActiveTokens = (history: typeof tokenHistory) => {
        const newTokens: { [key: string]: string } = {
            '3month': '',
            '6month': '',
            '1year': '',
        };

        Object.entries(history).forEach(([duration, tokens]) => {
            const activeToken = tokens.find((t) => t.status === 'Active');
            if (activeToken) {
                newTokens[duration] = activeToken.token;
            }
        });

        setTokens(newTokens);
    };

    // Function to generate a token
    const generateToken = async (duration: string) => {
        setIsLoading((prev) => ({ ...prev, [duration]: true }));

        try {
            // Generate new token
            const newToken = Array(16)
                .fill(0)
                .map(() => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    return chars.charAt(Math.floor(Math.random() * chars.length));
                })
                .join('');

            // Insert new token into Supabase
            const { data: insertedData, error: insertError } = await supabase
                .from('tokengenerate')
                .insert([
                    {
                        token: newToken,
                        duration: duration,
                        status: 'Active',
                    },
                ])
                .select();

            if (insertError) {
                throw insertError;
            }

            if (insertedData) {
                // Update token history with the new token
                const updatedHistory = {
                    ...tokenHistory,
                    [duration]: [
                        { token: newToken, status: 'Active', id: insertedData[0].id },
                        ...(tokenHistory[duration].length >= MAX_HISTORY_LENGTH
                            ? tokenHistory[duration].slice(0, MAX_HISTORY_LENGTH - 1)
                            : tokenHistory[duration]),
                    ],
                };

                setTokenHistory(updatedHistory);
                updateActiveTokens(updatedHistory);

                showToast('Token generated successfully!');
            }
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error in generateToken:', error);
            showToast(`Error: ${errorMessage}`);
        } finally {
            setIsLoading((prev) => ({ ...prev, [duration]: false }));
        }
    };

    // Function to delete a token
    const handleDeleteToken = async (tokenId: string, duration: string) => {
        if (!tokenId) {
            console.error('Token ID is undefined. Cannot delete.');
            showToast('Error deleting token: Token ID is missing.');
            return;
        }

        setIsDeletingToken((prev) => ({ ...prev, [duration]: { ...prev[duration], [tokenId]: true } }));

        try {
            // Delete the token from the tokengenerate table
            const { error: deleteError } = await supabase.from('tokengenerate').delete().eq('id', tokenId);

            if (deleteError) {
                throw deleteError;
            }

            // Update the token history locally
            const updatedHistory = {
                ...tokenHistory,
                [duration]: tokenHistory[duration].filter((item) => item.id !== tokenId),
            };

            setTokenHistory(updatedHistory);
            updateActiveTokens(updatedHistory);

            // Refresh the token user details
            fetchTokenUserDetails();
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error during token deletion:', error);
            showToast(`Error deleting token: ${errorMessage}`);
        } finally {
            setIsDeletingToken((prev) => ({ ...prev, [duration]: { ...prev[duration], [tokenId]: false } }));
        }
    };

    // Function to delete a user and associated token
    const handleDeleteUser = async (userId: string, token: string) => {
        if (!userId || !token) {
            console.error('User ID or Token is missing.');
            showToast('Error: User ID or Token is missing.');
            return;
        }

        try {
            // Delete the user from the users table
            const { error: userError } = await supabase.from('users').delete().eq('id', userId);

            if (userError) {
                throw userError;
            }

            // Delete the associated token from the tokengenerate table
            const { error: tokenError } = await supabase.from('tokengenerate').delete().eq('token', token);

            if (tokenError) {
                throw tokenError;
            }

            console.log('User and associated token deleted successfully!');
            showToast('User and associated token deleted successfully!');

            // Update the token history by removing the deleted token
            const updatedHistory = { ...tokenHistory };
            Object.keys(updatedHistory).forEach((duration) => {
                updatedHistory[duration] = updatedHistory[duration].filter((item) => item.token !== token);
            });

            setTokenHistory(updatedHistory);
            updateActiveTokens(updatedHistory);

            // Refresh the token user details
            fetchTokenUserDetails();
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error in handleDeleteUser:', errorMessage);
            showToast(`Error: ${errorMessage}`);
        }
    };

    // Function to open the delete confirmation modal
    const openDeleteModal = (userId: string, token: string) => {
        setSelectedUserForDelete({ userId, token });
        setIsDeleteModalOpen(true);
    };

    // Function to close the delete confirmation modal
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setSelectedUserForDelete(null);
    };

    // Function to handle delete action (token or user)
    const handleDeleteAction = async (action: 'token' | 'user') => {
        if (!selectedUserForDelete) return;

        const { userId, token } = selectedUserForDelete;

        if (action === 'token') {
            try {
                // Delete the token from the tokengenerate table
                const { error: tokenError } = await supabase.from('tokengenerate').delete().eq('token', token);

                if (tokenError) {
                    throw tokenError;
                }

                // Delete the token from the users table
                const { error: userError } = await supabase
                    .from('users')
                    .update({ token: null }) // Set token to null in the users table
                    .eq('id', userId);

                if (userError) {
                    throw userError;
                }

                // Update the token history locally
                const updatedHistory = { ...tokenHistory };
                Object.keys(updatedHistory).forEach((duration) => {
                    updatedHistory[duration] = updatedHistory[duration].filter((item) => item.token !== token);
                });
                setTokenHistory(updatedHistory);

                // Update the active tokens
                updateActiveTokens(updatedHistory);

                showToast('Token deleted successfully!');
                fetchTokenUserDetails(); // Refresh the token user details
            } catch (error) {
                console.error('Error deleting token:', error);
                showToast('Error deleting token');
            }
        } else if (action === 'user') {
            // Delete the user and their InUse token
            handleDeleteUser(userId, token);
        }

        closeDeleteModal();
    };

    // Function to open the renew modal
    const openRenewModal = (userId: string) => {
        setSelectedUserId(userId);
        setIsRenewModalOpen(true);
    };

    // Function to close the renew modal
    const closeRenewModal = () => {
        setIsRenewModalOpen(false);
        setSelectedUserId(null);
        setSelectedDuration('3month');
    };

    // Function to renew a token
    const handleRenewToken = async () => {
        if (!selectedUserId) {
            console.error('User ID is missing.');
            showToast('Error: User ID is missing.');
            return;
        }

        try {
            // Check if the user already has an active token
            const { data: existingToken, error: fetchError } = await supabase
                .from('tokengenerate')
                .select('token, expiresat')
                .eq('userid', selectedUserId)
                .not('token', 'is', null) // Ensure token is not null
                .neq('token', '') // Ensure token is not an empty string
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "No rows found" error
                throw fetchError;
            }

            if (existingToken) {
                const expiresAt = new Date(existingToken.expiresat);
                const currentDate = new Date();

                // Check if the token has expired
                if (currentDate < expiresAt) {
                    showToast('User already has an active token. Please delete the existing token before renewing.');
                    return;
                } else {
                    // Delete the expired token from the tokengenerate table
                    const { error: deleteError } = await supabase
                        .from('tokengenerate')
                        .delete()
                        .eq('token', existingToken.token);

                    if (deleteError) {
                        throw deleteError;
                    }
                }
            }

            // Generate a new token
            const newToken = Array(16)
                .fill(0)
                .map(() => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    return chars.charAt(Math.floor(Math.random() * chars.length));
                })
                .join('');

            // Calculate expiration date based on duration
            const createdat = new Date().toISOString();
            const expiresat = new Date();

            switch (selectedDuration) {
                case '3month':
                    expiresat.setMonth(expiresat.getMonth() + 3);
                    break;
                case '6month':
                    expiresat.setMonth(expiresat.getMonth() + 6);
                    break;
                case '1year':
                    expiresat.setFullYear(expiresat.getFullYear() + 1);
                    break;
                default:
                    throw new Error('Invalid duration');
            }

            // Insert the new token into the tokengenerate table
            const { data: insertedTokenData, error: insertTokenError } = await supabase
                .from('tokengenerate')
                .insert([
                    {
                        token: newToken,
                        createdat: createdat,
                        expiresat: expiresat.toISOString(),
                        duration: selectedDuration,
                        status: 'InUse',
                        userid: selectedUserId,
                    },
                ])
                .select();

            if (insertTokenError) {
                throw insertTokenError;
            }

            // Update the users table with the new token
            const { data: updatedUserData, error: userUpdateError } = await supabase
                .from('users')
                .update({
                    token: newToken,
                })
                .eq('id', selectedUserId)
                .select();

            if (userUpdateError) {
                throw userUpdateError;
            }

            if (insertedTokenData && updatedUserData) {
                showToast('Token renewed successfully!');
                // Refresh the token user details and token history
                fetchTokenUserDetails();
                fetchTokenHistory();
                closeRenewModal();
            }
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error renewing token:', errorMessage);
            showToast(`Error renewing token: ${errorMessage}`);
        }
    };

    // Fetch token history on component mount
    const fetchTokenHistory = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('tokengenerate')
                .select('id, token, status, duration, createdat, expiresat, userid')
                .order('createdat', { ascending: false });

            if (error) {
                throw error;
            }

            const history: typeof tokenHistory = {
                '3month': [],
                '6month': [],
                '1year': [],
            };

            data.forEach((item) => {
                if (history[item.duration]) {
                    history[item.duration].push({
                        token: item.token,
                        status: item.status,
                        id: item.id,
                    });
                }
            });

            setTokenHistory(history);
            updateActiveTokens(history); // Update active tokens when history is fetched
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error fetching token history:', errorMessage);
        }
    }, []);

    // Fetch token user details on component mount
    const fetchTokenUserDetails = async () => {
        try {
            // Fetch users from the users table
            const { data: users, error: usersError } = await supabase.from('users').select('id, username, token');

            if (usersError) {
                throw usersError;
            }

            // Fetch tokens from the tokengenerate table
            const { data: tokens, error: tokensError } = await supabase
                .from('tokengenerate')
                .select('token, duration, createdat, expiresat, userid');

            if (tokensError) {
                throw tokensError;
            }

            // Merge users and tokens data
            const formattedData = users.map((user) => {
                const tokenData = tokens.find((token) => token.userid === user.id);

                return {
                    token: tokenData?.token || user.token || 'N/A', // Show 'N/A' if token is empty or null
                    duration: tokenData?.duration || 'N/A',
                    createdat: tokenData?.createdat || 'N/A',
                    expiresat: tokenData?.expiresat || null, // Allow null for expiresat
                    username: user.username || 'N/A', // Access username
                    userId: user.id || null, // Access userId
                };
            });

            setTokenUsers(formattedData);
        } catch (error) {
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error);
            }
            console.error('Error fetching token user details:', errorMessage);
        }
    };

    useEffect(() => {
        fetchTokenUserDetails();
        fetchTokenHistory();
    }, [fetchTokenHistory]);

    // Function to format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        });
    };

    // Function to check if a token is expired
    const isTokenExpired = (expiresAt: string) => {
        const currentDate = new Date();
        const expiryDate = new Date(expiresAt);
        return currentDate > expiryDate;
    };

    // Function to get token status
    const getTokenStatus = (token: string, expiresAt: string | null) => {
        if (token === 'N/A' || expiresAt === null) {
            return 'N/A';
        } else if (isTokenExpired(expiresAt)) {
            return 'Expired';
        } else {
            return 'InUse';
        }
    };

    return (
        <div className="welcome-container">
            <div className="auth-card max-w-7xl w-full p-8">
                <div className="flex justify-between mb-8 items-center">
                    <h1 className="text-center">
                        <span style={{ 
                            color: '#D32F2F',
                            fontFamily: 'Audiowide, cursive',
                            fontSize: '2rem',
                            textShadow: '0 0 10px rgba(211, 47, 47, 0.3)'
                        }}>
                            KICK ~ LOCK ADMIN
                        </span>
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-white">Welcome, {adminName || 'Admin'}</span>
                        <button
                            onClick={handleLogout}
                            className="welcome-button"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Token Generator Section */}
                <div className="bg-[#1a1a1a] rounded-lg p-6 mb-8">
                    <h3 className="text-xl text-white font-bold mb-4">Token Generator</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.keys(tokens).map((duration) => (
                            <div key={duration} className="bg-[#2d2d2d] p-6 rounded-lg">
                                <h3 className="text-lg font-bold mb-4">
                                    {duration.charAt(0).toUpperCase() + duration.slice(1)} Token
                                </h3>
                                <div className="bg-gray-700 p-3 rounded mb-4 break-all flex items-center justify-between">
                                    <span className="text-sm font-mono flex-1 truncate mr-2">
                                        {tokens[duration] ? tokens[duration] : 'No active token'}
                                    </span>
                                    <span className={`text-xs ${tokens[duration] ? 'text-green-500' : 'text-gray-400'}`}>
                                        {tokens[duration] ? 'Active' : ''}
                                    </span>
                                </div>

                                <button
                                    className={`w-full py-2 px-4 rounded font-semibold ${
                                        isLoading[duration] ? 'bg-purple-700 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                                    onClick={() => generateToken(duration)}
                                    disabled={isLoading[duration]}
                                >
                                    {isLoading[duration] ? 'Generating...' : 'Generate Token'}
                                </button>

                                {/* Token History */}
                                <div className="mt-4">
                                    <h4 className="text-sm font-bold mb-2">Token History</h4>
                                    <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-gray-700 scrollbar-rounded">
                                        {tokenHistory[duration].map((item, index) => (
                                            <div key={index} className="bg-gray-700 p-2 rounded mb-2 text-sm flex justify-between items-center">
                                                <div className="flex-1 truncate mr-2">
                                                    <span className="font-mono">{item.token}</span>
                                                    <span className={`ml-2 ${item.status === 'Active' ? 'text-green-500' : item.status === 'InUse' ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => copyTokenToClipboard(item.token)}
                                                        className="text-blue-500 hover:text-blue-700 px-2 py-1 rounded"
                                                    >
                                                        Copy
                                                    </button>
                                                    {item.status === 'Active' && (
                                                        <button
                                                            onClick={() => handleDeleteToken(item.id, duration)}
                                                            disabled={isDeletingToken[duration][item.id] || false}
                                                            className={`text-red-500 hover:text-red-700 px-2 py-1 rounded ${
                                                                isDeletingToken[duration][item.id] ? 'opacity-50 cursor-not-allowed' : ''
                                                            }`}
                                                        >
                                                            {isDeletingToken[duration][item.id] ? 'Deleting...' : 'Delete'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Token User Details */}
                <div className="bg-[#1a1a1a] rounded-lg p-6">
                    <h3 className="text-xl text-white font-bold mb-4">Token User Details</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto border-collapse">
                            <thead>
                                <tr className="bg-gray-700">
                                    <th className="px-4 py-2 min-w-[200px] text-left">Token</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Duration</th>
                                    <th className="px-4 py-2 min-w-[150px] text-left">Username</th>
                                    <th className="px-4 py-2 min-w-[200px] text-left">Created At</th>
                                    <th className="px-4 py-2 min-w-[200px] text-left">Expires At</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Status</th>
                                    <th className="px-4 py-2 min-w-[100px] text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokenUsers.length > 0 ? (
                                    tokenUsers.map((user, index) => {
                                        const status = getTokenStatus(user.token, user.expiresat);
                                        return (
                                            <tr key={index} className={`text-sm ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700'} hover:bg-gray-600`}>
                                                <td className="px-4 py-2 break-all whitespace-nowrap">{user.token}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{user.duration}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{user.username}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{formatDate(user.createdat)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    {user.expiresat ? formatDate(user.expiresat) : 'N/A'}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 py-1 rounded text-sm ${
                                                            status === 'InUse'
                                                                ? 'bg-red-500'
                                                                : status === 'Expired'
                                                                ? 'bg-green-500'
                                                                : 'bg-yellow-500'
                                                        }`}
                                                    >
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            if (user.userId && user.token) {
                                                                openDeleteModal(user.userId, user.token);
                                                            } else {
                                                                console.error('User ID or Token is missing.');
                                                                showToast('Error: User ID or Token is missing.');
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 px-2 py-1 rounded"
                                                    >
                                                        Delete
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (user.userId) {
                                                                openRenewModal(user.userId);
                                                            } else {
                                                                console.error('User ID is missing.');
                                                                showToast('Error: User ID is missing.');
                                                            }
                                                        }}
                                                        className="text-blue-500 hover:text-blue-700 px-2 py-1 rounded ml-2"
                                                    >
                                                        Renew Token
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-4">
                                            No token user details available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modals with updated styling */}
                {isRenewModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-[#1a1a1a] p-6 rounded-lg w-96">
                            <h3 className="text-lg font-bold mb-4">Renew Token</h3>
                            <label className="block mb-4">
                                <span className="text-sm font-semibold">Select Duration:</span>
                                <select
                                    value={selectedDuration}
                                    onChange={(e) => setSelectedDuration(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded mt-1"
                                >
                                    <option value="3month">3 Months</option>
                                    <option value="6month">6 Months</option>
                                    <option value="1year">1 Year</option>
                                </select>
                            </label>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={closeRenewModal}
                                    className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRenewToken}
                                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                                >
                                    Renew
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-[#1a1a1a] p-6 rounded-lg w-96">
                            <h3 className="text-lg font-bold mb-4">Delete Confirmation</h3>
                            <p className="mb-4">What do you want to delete?</p>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => handleDeleteAction('token')}
                                    className="bg-red-600 hover:text-red-700 px-4 py-2 rounded"
                                >
                                    Delete Token
                                </button>
                                <button
                                    onClick={() => handleDeleteAction('user')}
                                    className="bg-red-600 hover:text-red-700 px-4 py-2 rounded"
                                >
                                    Delete User
                                </button>
                                <button
                                    onClick={closeDeleteModal}
                                    className="bg-gray-600 hover:text-gray-700 px-4 py-2 rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toast with updated styling */}
                {toastMessage && (
                    <div className="fixed bottom-4 right-4 bg-[#D32F2F] text-white px-4 py-2 rounded-lg shadow-lg">
                        {toastMessage}
                    </div>
                )}
            </div>
        </div>
    );
}