import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';

function Admin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const previousCountRef = useRef(0);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'https://falgunixerox-backend.onrender.com';

  const playBeep = () => {
    try {
      const audio = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='
      );
      audio.play().catch(() => {});
    } catch {}
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/orders`);
      const list = Array.isArray(res.data) ? res.data : res.data.orders || [];

      if (previousCountRef.current > 0 && list.length > previousCountRef.current) {
        playBeep();
      }

      previousCountRef.current = list.length;
      setOrders(list);
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const updateStatus = async (jobId, status) => {
    try {
      setActionLoading(`${jobId}-${status}`);
      await axios.post(`${API_BASE_URL}/api/admin/orders/${jobId}/status`, { status });
      await fetchOrders();
    } catch (error) {
      console.log(error);
      alert('Status update failed');
    } finally {
      setActionLoading('');
    }
  };

  const reprintOrder = async (jobId) => {
    if (!window.confirm('આ order ફરી print કરવો છે?')) return;

    try {
      setActionLoading(`${jobId}-reprint`);
      await axios.post(`${API_BASE_URL}/api/admin/jobs/${jobId}/reprint`);
      await fetchOrders();
    } catch (error) {
      console.log(error);
      alert('Reprint failed');
    } finally {
      setActionLoading('');
    }
  };

  const cancelOrder = async (jobId) => {
    if (!window.confirm('Order cancel કરવો છે?')) return;
    await updateStatus(jobId, 'cancelled');
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.toLowerCase().trim();
      const status = order.status || '';
      const payment = getPaymentText(order);
      const token = String(order.token || '');
      const jobId = String(order.jobId || '');
      const file = String(order.originalName || order.filename || '');

      const searchMatch =
        !q ||
        token.toLowerCase().includes(q) ||
        jobId.toLowerCase().includes(q) ||
        file.toLowerCase().includes(q);

      const statusMatch = statusFilter === 'all' || status === statusFilter;
      const paymentMatch = paymentFilter === 'all' || payment === paymentFilter;

      return searchMatch && statusMatch && paymentMatch;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const todayOrders = orders.filter((order) => {
    const d =
      order.razorpayPaidAt ||
      order.cashPaidAt ||
      order.cashCreatedAt ||
      order.onlineCreatedAt ||
      order.createdAt;

    if (!d) return false;
    return new Date(d).toDateString() === new Date().toDateString();
  });

  const totalCollection = todayOrders.reduce((sum, o) => sum + getAmount(o), 0);
  const cashTotal = todayOrders
    .filter((o) => getPaymentText(o) === 'cash')
    .reduce((sum, o) => sum + getAmount(o), 0);
  const onlineTotal = todayOrders
    .filter((o) => getPaymentText(o) === 'online')
    .reduce((sum, o) => sum + getAmount(o), 0);

  const printedCount = todayOrders.filter(
    (o) => o.status === 'printed' || o.status === 'done'
  ).length;

  const pendingCount = todayOrders.filter(
    (o) => o.status === 'pending_print' || o.status === 'razorpay_pending'
  ).length;

  if (loading) {
    return <h2 style={{ textAlign: 'center', marginTop: 60 }}>Loading Orders...</h2>;
  }

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>Falguni Xerox Admin</h1>
          <p style={subTitle}>Live Orders Dashboard</p>
        </div>

        <div style={topActions}>
          <button onClick={fetchOrders} style={btnGreen}>Refresh</button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={autoRefresh ? btnBlue : btnGray}
          >
            Auto: {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={cards}>
        <Card title="Today Collection" value={`Rs. ${totalCollection}`} />
        <Card title="Cash" value={`Rs. ${cashTotal}`} />
        <Card title="Online" value={`Rs. ${onlineTotal}`} />
        <Card title="Today Jobs" value={todayOrders.length} />
        <Card title="Printed" value={printedCount} />
        <Card title="Pending" value={pendingCount} />
      </div>

      <div style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search token / file / job id"
          style={input}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={select}>
          <option value="all">All Status</option>
          <option value="pending_print">Pending Print</option>
          <option value="razorpay_pending">Payment Pending</option>
          <option value="printed">Printed</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>

        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={select}>
          <option value="all">All Payment</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="-">No Payment</option>
        </select>

        <span style={lastUpdate}>Last update: {lastUpdated || '-'}</span>
      </div>

      {filteredOrders.length === 0 ? (
        <div style={emptyBox}>No orders found</div>
      ) : (
        <>
          <div style={desktopTable}>
            <table style={table}>
              <thead>
                <tr style={thead}>
                  <th style={th}>Token</th>
                  <th style={th}>Time</th>
                  <th style={th}>File</th>
                  <th style={th}>Pages</th>
                  <th style={th}>Copies</th>
                  <th style={th}>Type</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Payment</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => {
                  const jobId = order.jobId || order.id;
                  const status = order.status || '-';

                  return (
                    <tr key={jobId} style={{ background: getRowColor(status) }}>
                      <td style={td}>
                        <b style={tokenStyle}>#{order.token || shortId(jobId)}</b>
                      </td>
                      <td style={td}>{formatTime(order)}</td>
                      <td style={td}>
                        <div style={fileName}>{order.originalName || order.filename || '-'}</div>
                        {order.fileUrl && (
                          <a href={order.fileUrl} target="_blank" rel="noreferrer" style={link}>
                            View
                          </a>
                        )}
                      </td>
                      <td style={td}>{order.selectedPages || order.pages || '-'}</td>
                      <td style={td}>{order.copies || 1}</td>
                      <td style={td}>{formatPrintType(order.printType)}</td>
                      <td style={td}><b>Rs. {getAmount(order)}</b></td>
                      <td style={td}>{getPaymentBadge(getPaymentText(order))}</td>
                      <td style={td}>{getStatusBadge(status)}</td>
                      <td style={td}>
                        <ActionButtons
                          status={status}
                          jobId={jobId}
                          actionLoading={actionLoading}
                          updateStatus={updateStatus}
                          cancelOrder={cancelOrder}
                          reprintOrder={reprintOrder}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={mobileCards}>
            {filteredOrders.map((order) => {
              const jobId = order.jobId || order.id;
              const status = order.status || '-';

              return (
                <div key={jobId} style={{ ...mobileCard, borderLeft: `6px solid ${getStatusColor(status)}` }}>
                  <div style={mobileTop}>
                    <b style={tokenStyle}>#{order.token || shortId(jobId)}</b>
                    {getStatusBadge(status)}
                  </div>

                  <p><b>File:</b> {order.originalName || order.filename || '-'}</p>
                  <p><b>Time:</b> {formatTime(order)}</p>
                  <p><b>Pages:</b> {order.selectedPages || order.pages || '-'} | <b>Copies:</b> {order.copies || 1}</p>
                  <p><b>Type:</b> {formatPrintType(order.printType)}</p>
                  <p><b>Amount:</b> Rs. {getAmount(order)} | <b>Payment:</b> {getPaymentText(order)}</p>

                  {order.fileUrl && (
                    <a href={order.fileUrl} target="_blank" rel="noreferrer" style={link}>
                      Open File
                    </a>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <ActionButtons
                      status={status}
                      jobId={jobId}
                      actionLoading={actionLoading}
                      updateStatus={updateStatus}
                      cancelOrder={cancelOrder}
                      reprintOrder={reprintOrder}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ActionButtons({ status, jobId, actionLoading, updateStatus, cancelOrder, reprintOrder }) {
  const disabled = actionLoading !== '';

  if (status === 'printed' || status === 'done' || status === 'failed' || status === 'cancelled') {
    return (
      <button onClick={() => reprintOrder(jobId)} disabled={disabled} style={btnBlue}>
        Reprint
      </button>
    );
  }

  return (
    <>
      <button onClick={() => updateStatus(jobId, 'printed')} disabled={disabled} style={btnGreen}>
        Mark Printed
      </button>
      <button onClick={() => cancelOrder(jobId)} disabled={disabled} style={btnRed}>
        Cancel
      </button>
    </>
  );
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      <div style={cardValue}>{value}</div>
    </div>
  );
}

function getPaymentText(order) {
  if (order.payment?.method) return order.payment.method;
  if (order.razorpayPaymentId || order.razorpay_payment_id) return 'online';
  return '-';
}

function getAmount(order) {
  return Number(order.price || order.amount || 0);
}

function formatTime(order) {
  const value =
    order.razorpayPaidAt ||
    order.cashPaidAt ||
    order.cashCreatedAt ||
    order.onlineCreatedAt ||
    order.createdAt ||
    order.time;

  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN');
}

function formatPrintType(type) {
  if (type === 'single') return 'Single';
  if (type === 'duplex_long') return 'Duplex Long';
  if (type === 'duplex_short') return 'Duplex Short';
  return type || '-';
}

function shortId(id) {
  return String(id || '').slice(0, 8);
}

function getRowColor(status) {
  if (status === 'printed' || status === 'done') return '#e8f8ee';
  if (status === 'pending_print') return '#fff8dd';
  if (status === 'razorpay_pending') return '#eaf2ff';
  if (status === 'failed') return '#fdeaea';
  if (status === 'cancelled') return '#eeeeee';
  return '#ffffff';
}

function getStatusColor(status) {
  if (status === 'printed' || status === 'done') return '#16a34a';
  if (status === 'pending_print') return '#f59e0b';
  if (status === 'razorpay_pending') return '#2563eb';
  if (status === 'failed') return '#dc2626';
  if (status === 'cancelled') return '#6b7280';
  return '#94a3b8';
}

function getStatusBadge(status) {
  const color = getStatusColor(status);
  return (
    <span style={{ ...badge, background: color }}>
      {String(status).replaceAll('_', ' ').toUpperCase()}
    </span>
  );
}

function getPaymentBadge(payment) {
  const bg = payment === 'cash' ? '#f59e0b' : payment === 'online' ? '#2563eb' : '#6b7280';
  return <span style={{ ...badge, background: bg }}>{payment.toUpperCase()}</span>;
}

const page = {
  padding: 20,
  maxWidth: 1500,
  margin: '0 auto',
  fontFamily: '"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  background: '#f5f7fb',
  minHeight: '100vh',
};

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 15,
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 18,
};

const title = {
  margin: 0,
  fontSize: 30,
  color: '#0f172a',
};

const subTitle = {
  margin: '4px 0 0',
  color: '#64748b',
};

const topActions = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const cards = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
  gap: 12,
  marginBottom: 18,
};

const card = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 16,
  background: '#ffffff',
  boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
};

const cardTitle = {
  fontSize: 14,
  color: '#64748b',
};

const cardValue = {
  fontSize: 27,
  fontWeight: 'bold',
  marginTop: 4,
  color: '#0f172a',
};

const toolbar = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  padding: 12,
  borderRadius: 14,
  marginBottom: 15,
};

const input = {
  flex: '1 1 260px',
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 15,
};

const select = {
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  fontSize: 15,
  background: '#fff',
};

const lastUpdate = {
  color: '#64748b',
  fontSize: 14,
};

const desktopTable = {
  overflowX: 'auto',
  background: '#ffffff',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
};

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 1180,
};

const thead = {
  background: '#0a8f08',
  color: 'white',
};

const th = {
  padding: 12,
  borderBottom: '1px solid #dbe4ef',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const td = {
  padding: 11,
  borderBottom: '1px solid #edf2f7',
  verticalAlign: 'top',
};

const tokenStyle = {
  display: 'inline-block',
  maxWidth: 90,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  lineHeight: 1.25,
  color: '#0f172a',
};

const fileName = {
  maxWidth: 230,
  overflowWrap: 'anywhere',
  fontSize: 14,
};

const link = {
  color: '#2563eb',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: 5,
};

const badge = {
  display: 'inline-block',
  color: 'white',
  padding: '5px 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
};

const btnGreen = {
  background: '#0a8f08',
  color: 'white',
  border: 'none',
  padding: '8px 11px',
  borderRadius: 8,
  cursor: 'pointer',
  marginRight: 6,
  fontWeight: 'bold',
};

const btnBlue = { ...btnGreen, background: '#2563eb' };
const btnRed = { ...btnGreen, background: '#dc2626' };
const btnGray = { ...btnGreen, background: '#64748b' };

const emptyBox = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 30,
  textAlign: 'center',
  color: '#64748b',
};

const mobileCards = {
  display: 'none',
};

const mobileCard = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
  boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
};

const mobileTop = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  marginBottom: 10,
};

export default Admin;