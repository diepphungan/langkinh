import { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  KeyRound,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type {
  FinanceRuntimeSettingsStatus,
  WebhookChannelsStatus,
} from '../types/news';

interface FinanceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'ssi' | 'channels';
  status: FinanceRuntimeSettingsStatus | null;
  onStatusUpdated: (next: FinanceRuntimeSettingsStatus) => void;
  webhookStatus: WebhookChannelsStatus | null;
  onWebhookStatusUpdated: (next: WebhookChannelsStatus) => void;
}

export function FinanceSettingsModal({
  open,
  onClose,
  initialTab = 'ssi',
  status,
  onStatusUpdated,
  webhookStatus,
  onWebhookStatusUpdated,
}: FinanceSettingsModalProps) {
  const [activeSection, setActiveSection] = useState<'ssi' | 'channels'>(initialTab);

  // SSI & Red Alert Webhook state
  const [consumerId, setConsumerId] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Telegram & Lark Newsroom Edition Channels state
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [larkWebhookUrl, setLarkWebhookUrl] = useState('');
  const [autoSendEnabled, setAutoSendEnabled] = useState(
    webhookStatus?.autoSendEnabled ?? true
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialTab);
    setFeedback(null);
    if (webhookStatus) {
      setAutoSendEnabled(webhookStatus.autoSendEnabled);
    }
  }, [open, initialTab, webhookStatus]);

  if (!open) return null;

  const handleSaveSsi = async (testConnection: boolean) => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = { testConnection };
      if (consumerId.trim() && consumerSecret.trim()) {
        payload.ssiConsumerId = consumerId.trim();
        payload.ssiConsumerSecret = consumerSecret.trim();
      }
      if (webhookUrl.trim()) {
        payload.webhookUrl = webhookUrl.trim();
      }

      const res = await fetch('/api/finance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        onStatusUpdated(data as FinanceRuntimeSettingsStatus);
        throw new Error(data.error || 'Không thể lưu cấu hình SSI & Webhook.');
      }
      onStatusUpdated(data as FinanceRuntimeSettingsStatus);
      setConsumerId('');
      setConsumerSecret('');
      setFeedback({
        type: 'ok',
        text: data.testResult || 'Đã cập nhật cấu hình SSI FastConnect Data & Webhook.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearSsi = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/finance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearSsiCredentials: true }),
      });
      const data = await res.json();
      if (res.ok) {
        onStatusUpdated(data as FinanceRuntimeSettingsStatus);
        setFeedback({
          type: 'ok',
          text: 'Đã xóa khóa SSI runtime; hệ thống chuyển về nguồn env (nếu có) hoặc chế độ dự phòng.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClearFinanceWebhook = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/finance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: '' }),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookUrl('');
        onStatusUpdated(data as FinanceRuntimeSettingsStatus);
        setFeedback({ type: 'ok', text: 'Đã tắt cấu hình Webhook cảnh báo cổ phiếu.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannels = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        autoSendEnabled,
      };
      if (telegramBotToken.trim()) payload.telegramBotToken = telegramBotToken.trim();
      if (telegramChatId.trim()) payload.telegramChatId = telegramChatId.trim();
      if (larkWebhookUrl.trim()) payload.larkWebhookUrl = larkWebhookUrl.trim();

      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu cấu hình Telegram & Lark.');
      }
      onWebhookStatusUpdated(data as WebhookChannelsStatus);
      setTelegramBotToken('');
      setTelegramChatId('');
      setLarkWebhookUrl('');
      setFeedback({
        type: 'ok',
        text: 'Đã lưu cấu hình kênh Telegram Bot & Lark Webhook cho Ấn bản 08:00 & 17:00.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClearChannel = async (target: 'telegram' | 'lark') => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          target === 'telegram' ? { clearTelegram: true } : { clearLark: true }
        ),
      });
      const data = await res.json();
      if (res.ok) {
        onWebhookStatusUpdated(data as WebhookChannelsStatus);
        setFeedback({
          type: 'ok',
          text:
            target === 'telegram'
              ? 'Đã gỡ cấu hình Telegram Bot.'
              : 'Đã gỡ cấu hình Lark Webhook.',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestChannels = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      // Save pending inputs first if user typed them before pressing test
      if (telegramBotToken.trim() || telegramChatId.trim() || larkWebhookUrl.trim()) {
        const savePayload: Record<string, unknown> = { autoSendEnabled };
        if (telegramBotToken.trim()) savePayload.telegramBotToken = telegramBotToken.trim();
        if (telegramChatId.trim()) savePayload.telegramChatId = telegramChatId.trim();
        if (larkWebhookUrl.trim()) savePayload.larkWebhookUrl = larkWebhookUrl.trim();
        const saveRes = await fetch('/api/settings/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savePayload),
        });
        if (saveRes.ok) {
          onWebhookStatusUpdated((await saveRes.json()) as WebhookChannelsStatus);
          setTelegramBotToken('');
          setTelegramChatId('');
          setLarkWebhookUrl('');
        }
      }

      const res = await fetch('/api/newsroom/edition/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testOnly: true, channels: ['telegram', 'lark'] }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể gửi tin nhắn thử nghiệm.');
      }
      if (data.status) {
        onWebhookStatusUpdated(data.status as WebhookChannelsStatus);
      }

      const msgs: string[] = [];
      let anyOk = false;
      if (data.telegram?.attempted) {
        msgs.push(`Telegram: ${data.telegram.message}`);
        if (data.telegram.ok) anyOk = true;
      }
      if (data.lark?.attempted) {
        msgs.push(`Lark: ${data.lark.message}`);
        if (data.lark.ok) anyOk = true;
      }

      if (msgs.length === 0) {
        setFeedback({
          type: 'err',
          text: 'Vui lòng nhập ít nhất Telegram Bot Token + Chat ID hoặc Lark Webhook URL trước khi kiểm tra.',
        });
      } else {
        setFeedback({
          type: anyOk ? 'ok' : 'err',
          text: msgs.join(' · '),
        });
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi gửi tin nhắn thử nghiệm.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-settings-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Cấu hình kết nối thị trường &amp; Kênh phát hành tự động
            </p>
            <h2
              id="finance-settings-title"
              className="mt-1 font-sans tracking-tight text-2xl font-bold text-slate-900 dark:text-slate-100"
            >
              SSI FastConnect &amp; Telegram / Lark Bot
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Đóng cài đặt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section Switcher Tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveSection('ssi');
              setFeedback(null);
            }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeSection === 'ssi'
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
            }`}
          >
            SSI FastConnect &amp; Cảnh báo Watchlist
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('channels');
              setFeedback(null);
            }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeSection === 'channels'
                ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
            }`}
          >
            Telegram / Lark Bot (Ấn bản 08:00 &amp; 17:00)
          </button>
        </div>

        {activeSection === 'ssi' ? (
          <>
            {/* Current Runtime Status */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Trạng thái SSI API</span>
                  <span
                    className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      status?.ssiConfigured
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {status?.ssiConfigured
                      ? status.ssiSource === 'env'
                        ? 'ENV Active'
                        : 'Runtime Active'
                      : 'Fallback (.VN)'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                  {status?.ssiConsumerIdMasked || 'Chưa cấu hình Consumer ID'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {status?.tokenCached
                    ? 'JWT Token đang cache & tự động làm mới'
                    : `${status?.securitiesCount || 52} mã đồng bộ sẵn sàng`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Webhook Cảnh báo Đỏ</span>
                  <span
                    className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      status?.webhookConfigured
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {status?.webhookConfigured ? 'Đã bật' : 'Chưa bật'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                  {status?.webhookUrlMasked || 'Chưa cấu hình URL Webhook'}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Gửi tức thì khi cổ phiếu Watchlist chạm ngưỡng cảnh báo
                </p>
              </div>
            </div>

            {/* SSI Credentials Form */}
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <KeyRound className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                    <span>SSI FastConnect Data v2 (Tùy chọn)</span>
                  </label>
                  {status?.ssiSource === 'runtime' && (
                    <button
                      type="button"
                      onClick={() => void handleClearSsi()}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline dark:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Xóa khóa runtime
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Kết nối <code className="font-mono">fc-data.ssi.com.vn</code> để lấy giá khớp lệnh, khối ngoại mua/bán ròng và bảng mã HOSE/HNX/UPCOM. Nếu bỏ trống, hệ thống dùng dữ liệu thị trường dự phòng (.VN).
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      SSI Consumer ID
                    </label>
                    <input
                      type="text"
                      value={consumerId}
                      onChange={(e) => setConsumerId(e.target.value)}
                      placeholder="Nhập Consumer ID từ SSI..."
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      SSI Consumer Secret
                    </label>
                    <input
                      type="password"
                      value={consumerSecret}
                      onChange={(e) => setConsumerSecret(e.target.value)}
                      placeholder="Nhập Consumer Secret..."
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <BellRing className="h-4 w-4 text-red-700 dark:text-red-400" />
                    <span>Webhook Cảnh báo Đỏ tự động</span>
                  </label>
                  {status?.webhookConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearFinanceWebhook()}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700 dark:text-slate-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Gỡ Webhook
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Khi phát sinh Cảnh báo Đỏ (giảm vượt ngưỡng, cắt lỗ hoặc tin tiêu cực nghiêm trọng), hệ thống tự động gửi bản tin tóm tắt tới Webhook URL.
                </p>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/... hoặc Webhook URL"
                  className="mt-2.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Telegram & Lark Bot Channels Status */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Telegram Bot</span>
                  <span
                    className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      webhookStatus?.telegramConfigured
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {webhookStatus?.telegramConfigured ? 'Sẵn sàng' : 'Chưa cấu hình'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                  {webhookStatus?.telegramConfigured
                    ? `Token: ${webhookStatus.telegramBotTokenMasked} · Chat: ${webhookStatus.telegramChatIdMasked}`
                    : 'Chưa nhập Bot Token & Chat ID'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Lark Custom Bot</span>
                  <span
                    className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      webhookStatus?.larkConfigured
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {webhookStatus?.larkConfigured ? 'Sẵn sàng' : 'Chưa cấu hình'}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                  {webhookStatus?.larkConfigured
                    ? webhookStatus.larkWebhookUrlMasked
                    : 'Chưa nhập Lark Webhook URL'}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Telegram Bot Config */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    1. Telegram Bot API (Định dạng HTML sắc nét)
                  </span>
                  {webhookStatus?.telegramConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearChannel('telegram')}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline dark:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Gỡ Telegram
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Lấy Token từ <code className="font-mono">@BotFather</code> và Chat ID (nhóm hoặc cá nhân) để nhận Top 10 tin tổng hợp định kỳ.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Telegram Bot Token
                    </label>
                    <input
                      type="password"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGHI..."
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Telegram Chat ID
                    </label>
                    <input
                      type="text"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      placeholder="-1001234567890 hoặc 987654321"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Lark Webhook Config */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    2. Lark Custom Bot Webhook (Interactive Card)
                  </span>
                  {webhookStatus?.larkConfigured && (
                    <button
                      type="button"
                      onClick={() => void handleClearChannel('lark')}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline dark:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Gỡ Lark
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Hỗ trợ Larksuite / Feishu Custom Bot Card kèm tiêu đề màu báo chí (Cam cho 08:00, Xanh cho 17:00) và nút &ldquo;Mở bài gốc&rdquo;.
                </p>
                <input
                  type="url"
                  value={larkWebhookUrl}
                  onChange={(e) => setLarkWebhookUrl(e.target.value)}
                  placeholder="https://open.larksuite.com/open-apis/bot/v2/hook/..."
                  className="mt-2.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Automatic 08:00 & 17:00 Scheduler Toggle */}
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer dark:border-slate-800 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={autoSendEnabled}
                  onChange={(e) => setAutoSendEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-slate-900 dark:accent-slate-100"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Tự động tổng hợp &amp; gửi Ấn bản lúc 08:00 Sáng và 17:00 Chiều (GMT+7)
                  </span>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Đúng 08:00 và 17:00 hằng ngày, máy chủ tự đồng bộ nguồn tin, chọn Top 10 tin quan trọng nhất và gửi thẳng tới Telegram / Lark đã cấu hình.
                  </p>
                </div>
              </label>

              {webhookStatus?.lastDeliverySummary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Lần gửi gần nhất: {webhookStatus.lastDeliverySummary}
                </div>
              )}
            </div>
          </>
        )}

        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
              feedback.type === 'ok'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            Đóng
          </button>

          {activeSection === 'ssi' ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveSsi(false)}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-300 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Lưu cài đặt SSI
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveSsi(true)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
              >
                {saving ? 'Đang kiểm tra...' : 'Lưu & Kiểm tra Token SSI'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleTestChannels()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-300 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Gửi tin nhắn thử nghiệm</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSaveChannels()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
              >
                {saving ? 'Đang lưu...' : 'Lưu cấu hình Kênh gửi'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
