import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  Camera,
  Building2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Save
} from 'lucide-react';
import { useAuth, useData } from '../context/AppContext';
import { HostelName } from '../types';
import { HOSTEL_TABLE } from '../utils/institute';
import { Button, UserNameWithTag } from './UI';

export const EditProfile = () => {
  const { user, updateProfile, updatePassword } = useAuth();
  const { hostels } = useData();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive initial first & last name from user
  const initialFirst = user?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || '';
  const initialLast =
    user?.lastName !== undefined
      ? user.lastName
      : user?.name?.trim().split(/\s+/).slice(1).join(' ') || '';

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [selectedHostel, setSelectedHostel] = useState<HostelName>(
    (user?.hostel as HostelName) || 'Vivekananda'
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Password change state
  const [previousPassword, setPreviousPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Feedback banners
  const [profileStatus, setProfileStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fName = user.firstName?.trim() || user.name.trim().split(/\s+/)[0] || '';
    const lName =
      user.lastName !== undefined
        ? user.lastName
        : user.name.trim().split(/\s+/).slice(1).join(' ') || '';
    setFirstName(fName);
    setLastName(lName);
    setSelectedHostel((user.hostel as HostelName) || 'Vivekananda');
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  if (!user) return null;

  const availableHostels = hostels.length > 0 ? hostels : HOSTEL_TABLE;
  const activeHostelDetails =
    availableHostels.find(h => h.name === selectedHostel) || availableHostels[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileStatus({
        type: 'error',
        message: 'Please select a valid image file (PNG, JPG, WEBP, GIF).'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setProfileStatus(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (!customImageUrlInput.trim()) return;
    setAvatarUrl(customImageUrlInput.trim());
    setCustomImageUrlInput('');
    setShowUrlInput(false);
    setProfileStatus(null);
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileStatus(null);

    if (!firstName.trim()) {
      setProfileStatus({
        type: 'error',
        message: 'First name is required.'
      });
      return;
    }

    const result = await updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      hostel: selectedHostel,
      avatarUrl
    });

    if (!result.success) {
      setProfileStatus({
        type: 'error',
        message: result.error || 'Could not update profile settings.'
      });
      return;
    }

    // If the user also typed into the password fields, process password update too
    if (previousPassword || newPassword || confirmNewPassword) {
      await handleChangePassword();
    }

    setProfileStatus({
      type: 'success',
      message: 'Account profile settings saved successfully.'
    });
  };

  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordStatus(null);

    if (!previousPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'Please enter your previous password to set a new password.'
      });
      return;
    }

    if (!newPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'Please enter a new password.'
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({
        type: 'error',
        message: 'New password and confirmation do not match.'
      });
      return;
    }

    const result = await updatePassword({
      previousPassword,
      newPassword
    });

    if (!result.success) {
      setPasswordStatus({
        type: 'error',
        message: result.error || 'Failed to update password.'
      });
      return;
    }

    setPreviousPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordStatus({
      type: 'success',
      message: 'Password updated successfully.'
    });
  };

  const displayInitial = (firstName.trim() || user.name || 'S').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100/80 dark:border-slate-800 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-800 border border-indigo-200/60 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 text-indigo-700 dark:text-indigo-300 font-bold text-xl">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={() => setAvatarUrl(undefined)}
              />
            ) : (
              displayInitial
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Edit Profile
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                {user.rollNo}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage your profile photo, display name, hostel assignment, and account password.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/50 dark:border-indigo-800/50">
            {user.branch !== '-' ? `${user.branch} • ${user.admissionYear}` : user.hostel}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700">
            {user.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Photo & Personal Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Profile Photo & Name Card */}
          <form
            onSubmit={handleSaveProfile}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Profile Photo & Personal Details
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Update how your name and photo appear across IRIS
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Photo Upload & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-indigo-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden text-indigo-700 dark:text-indigo-300 font-extrabold text-2xl">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile Preview"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarUrl(undefined)}
                    />
                  ) : (
                    displayInitial
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-90 transition-all cursor-pointer"
                  title="Upload new photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="space-y-2.5 flex-1 min-w-0">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Profile Picture
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Upload an image from your device or paste an image URL.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="!text-xs !py-1.5 !px-3"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowUrlInput(prev => !prev)}
                    className="!text-xs !py-1.5 !px-3"
                  >
                    <span>{showUrlInput ? 'Cancel URL' : 'Paste Image URL'}</span>
                  </Button>

                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAvatarUrl(undefined)}
                      className="!text-xs !py-1.5 !px-2.5 !text-rose-600 dark:!text-rose-400 hover:!bg-rose-50 dark:hover:!bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </Button>
                  )}
                </div>

                {showUrlInput && (
                  <div className="flex items-center gap-2 pt-1 animate-tab-enter">
                    <input
                      type="url"
                      placeholder="https://example.com/avatar.png"
                      value={customImageUrlInput}
                      onChange={e => setCustomImageUrlInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleApplyCustomUrl}
                      className="!text-xs !py-1.5 !px-3"
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Name Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => {
                    setFirstName(e.target.value);
                    setProfileStatus(null);
                  }}
                  placeholder="First Name"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => {
                    setLastName(e.target.value);
                    setProfileStatus(null);
                  }}
                  placeholder="Last Name"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm"
                />
              </div>
            </div>

            {/* Read-only Inferred Institute Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Institute Email ID (Verified)
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3.5 py-2.5 border border-slate-200/70 dark:border-slate-800 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Roll Number & Batch
                </label>
                <input
                  type="text"
                  value={`${user.rollNo} (${user.branch !== '-' ? user.branch : 'HR'} • ${user.admissionYear})`}
                  disabled
                  className="w-full px-3.5 py-2.5 border border-slate-200/70 dark:border-slate-800 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm font-mono cursor-not-allowed"
                />
              </div>
            </div>

            {/* Hostel Selection Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Hostel Assignment
              </label>
              <select
                value={selectedHostel}
                onChange={e => {
                  setSelectedHostel(e.target.value as HostelName);
                  setProfileStatus(null);
                }}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm cursor-pointer"
              >
                {availableHostels.map(h => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            {profileStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-scale-in ${
                  profileStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-300'
                }`}
              >
                {profileStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{profileStatus.message}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Badge preview:</span>
                <UserNameWithTag
                  user={{
                    ...user,
                    name: `${firstName.trim()} ${lastName.trim()}`.trim() || user.name,
                    hostel: selectedHostel
                  }}
                />
              </div>

              <Button type="submit" variant="primary">
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </Button>
            </div>
          </form>

          {/* 2. Password Update Card */}
          <form
            onSubmit={handleChangePassword}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Change Password
                  </h2>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Requires verification of your current password
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswords(prev => !prev)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Previous Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={previousPassword}
                onChange={e => {
                  setPreviousPassword(e.target.value);
                  setPasswordStatus(null);
                }}
                placeholder="Enter your current password"
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setPasswordStatus(null);
                  }}
                  placeholder="Enter new password"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={e => {
                    setConfirmNewPassword(e.target.value);
                    setPasswordStatus(null);
                  }}
                  placeholder="Confirm new password"
                  className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/80 outline-none bg-white dark:bg-slate-800/90 dark:text-slate-100 transition-all text-sm"
                />
              </div>
            </div>

            {passwordStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-scale-in ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-300'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{passwordStatus.message}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button type="submit" variant="amber">
                <Lock className="w-4 h-4" />
                <span>Update Password</span>
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Assigned Hostel Information Card (from HOSTEL_TABLE) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Hostel Information
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Details for your selected residence hall
                </p>
              </div>
            </div>

            <div key={activeHostelDetails.id} className="space-y-4 animate-tab-enter">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeHostelDetails.name}
                  </span>
                  <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                    {activeHostelDetails.code}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="py-2 border-b border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Hostel Warden</span>
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeHostelDetails.warden_name}
                  </div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    <span>{activeHostelDetails.warden_email}</span>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <div className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>Hostel Representative (HR)</span>
                  </div>
                  {activeHostelDetails?.hr_name ? (
                    <div className="space-y-1 pt-0.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserNameWithTag name={activeHostelDetails.hr_name} />
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100/90 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700/70 leading-none">
                          {activeHostelDetails.name} HR
                        </span>
                      </div>
                      {activeHostelDetails.hr_rollNo && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          Roll No: {activeHostelDetails.hr_rollNo}
                        </div>
                      )}
                      {activeHostelDetails.hr_email && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{activeHostelDetails.hr_email}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 dark:text-slate-500 italic">
                      Not assigned
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
