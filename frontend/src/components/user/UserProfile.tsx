import React, { useState } from 'react';
import {
  User,
  Shield,
  Mail,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Lightbulb,
  Info,
  Check,
  Award,
  Sparkles,
  Lock,
  Key
} from 'lucide-react';

interface UserProfileProps {
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    department?: string;
    avatar_url?: string;
    created_at?: string;
    last_login?: string;
  };
}

export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="animate-slideup" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. Hero Profile Banner Card (Lilac / Soft Lavender Mountain Sky Gradient) */}
      <div style={{
        background: 'linear-gradient(135deg, #ede9fe 0%, #f3e8ff 40%, #fdf2f8 75%, #f0fdf4 100%)',
        borderRadius: '16px',
        padding: '16px 28px',
        border: '1px solid rgba(216, 180, 254, 0.6)',
        boxShadow: '0 4px 16px rgba(139, 92, 246, 0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Soft Background Wave Glow */}
        <div style={{
          position: 'absolute', right: '-20px', bottom: '-20px', width: '280px', height: '140px',
          background: 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.18), transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Left Side: Avatar & Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            fontWeight: '800',
            color: '#ffffff',
            boxShadow: '0 6px 20px rgba(139, 92, 246, 0.35)',
            border: '3px solid #ffffff'
          }}>
            {user?.name ? user.name[0].toUpperCase() : 'M'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
              USER ACCOUNT
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {user?.name || 'Ismeet'}
              </h1>
              <span style={{
                background: '#ede9fe',
                color: '#7c3aed',
                padding: '2px 10px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.03em',
                border: '1px solid #ddd6fe'
              }}>
                USER ROLE
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>
              AI Quality Assurance Specialist
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Testing today for safer AI tomorrow.
            </p>

            {/* Badges Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: '#10b981', color: '#ffffff', padding: '2px 9px',
                borderRadius: '14px', fontSize: '11px', fontWeight: '700'
              }}>
                <Check size={11} strokeWidth={3} />
                <span>Active & Verified</span>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                color: '#475569', fontSize: '12px', fontWeight: '500'
              }}>
                <Calendar size={12} style={{ color: '#7c3aed' }} />
                <span>Member since 12 Mar 2024</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Inspirational Quote with Purple Accent Bar */}
        <div style={{ textAlign: 'right', zIndex: 1, maxWidth: '260px' }}>
          <p style={{
            margin: 0,
            fontSize: '16px',
            fontStyle: 'italic',
            fontWeight: '700',
            color: '#4c1d95',
            lineHeight: 1.35,
            letterSpacing: '-0.01em'
          }}>
            “For a brighter future.”
          </p>
          <div style={{
            width: '40px',
            height: '3px',
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
            borderRadius: '2px',
            marginLeft: 'auto',
            marginTop: '6px'
          }} />
        </div>
      </div>

      {/* 2. Main 2-Column Balanced Information Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '14px',
        width: '100%',
        flex: 1
      }}>
        
        {/* Card 1: Account Information */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Card Header with Edit Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: '#f5f3ff', color: '#8b5cf6',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <User size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Account Information
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Your registered details and organization information
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '5px 12px', borderRadius: '7px',
                background: '#f5f3ff', border: '1px solid #ddd6fe',
                color: '#7c3aed', fontSize: '11.5px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <Edit3 size={12} />
              <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
          </div>

          {/* Details Table Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', fontSize: '12.5px', flex: 1 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <User size={14} style={{ color: '#8b5cf6' }} />
                <span>Full Legal Name</span>
              </div>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>{user?.name || 'Ismeet'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <Mail size={14} style={{ color: '#8b5cf6' }} />
                <span>Email Address</span>
              </div>
              <span style={{ fontWeight: '700', color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>
                {user?.email || 'ismeet@certifyai.in'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <Award size={14} style={{ color: '#8b5cf6' }} />
                <span>Assigned Role</span>
              </div>
              <span style={{
                background: '#ede9fe', color: '#7c3aed', padding: '1px 8px',
                borderRadius: '10px', fontSize: '10.5px', fontWeight: '800'
              }}>
                USER
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <Building size={14} style={{ color: '#8b5cf6' }} />
                <span>Department</span>
              </div>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>
                {user?.department || 'AI Quality Assurance & Testing'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <Calendar size={14} style={{ color: '#8b5cf6' }} />
                <span>Member Since</span>
              </div>
              <span style={{ fontWeight: '600', color: '#334155' }}>12 Mar 2024</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                <Shield size={14} style={{ color: '#8b5cf6' }} />
                <span>Account Status</span>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontWeight: '700' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                Active & Verified
              </span>
            </div>

          </div>

          {/* Identity Security Box */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: 'auto'
          }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', background: '#8b5cf6', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Lock size={10} />
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.35 }}>
              <strong style={{ color: '#334155' }}>Authenticated Session:</strong> 256-bit SHA token issued by CertifyAI Authority.
            </div>
          </div>
        </div>

        {/* Card 2: Permissions & Capabilities */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '18px 22px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Card Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: '#ecfdf5', color: '#059669',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Permissions & Capabilities
              </h3>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Authorizations granted under USER role
              </span>
            </div>
          </div>

          {/* Capabilities List with Green Checkmarks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>Test AI agents using the testing studio</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>View your test scores and detailed results</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>Access your previous tests and test history</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>Download audit reports (PDF, JSON, Certificate)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>View available agents and their information</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={11} strokeWidth={3} />
              </div>
              <span>Use compliance insights and remediation suggestions</span>
            </div>

          </div>

          {/* Role Boundary Box (Soft Violet / Lavender) */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: '#f5f3ff',
            border: '1px solid #ede9fe',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginTop: 'auto'
          }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', background: '#7c3aed', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10.5px', fontWeight: '800'
            }}>
              i
            </div>
            <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.35 }}>
              <strong style={{ color: '#6d28d9', display: 'block', marginBottom: '1px' }}>Role Boundary</strong>
              Administrative features, user management and system settings are reserved for Syed (ADMIN).
            </div>
          </div>

        </div>

      </div>

      {/* 3. Bottom Motivational Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '12px 24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#f5f3ff', color: '#8b5cf6',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Lightbulb size={16} />
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Keep Testing. Keep Improving.
            </h4>
            <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
              Your work helps build reliable and trustworthy AI systems.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
            Certify<span style={{ color: '#7c3aed' }}>AI</span>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
            The Trust Layer for Autonomous AI
          </div>
        </div>
      </div>

    </div>
  );
};
