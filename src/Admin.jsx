import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function Admin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const previousCountRef = useRef(0);

  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    'http://localhost:5000';

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
    const interval = setInterval(fetchOrders, 3000);
    return () => clearInterval(interval);
  }, []);

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

  const getPaymentText = (order) => {
    if (order.payment?.method) return order.payment.method;
    if (order.razorpay_payment_id) return 'online';
    return '-';
  };

  const getAmount = (order) => Number(order.price || order.amount || 0);

  const todayOrders = orders.filter((order) => {
    const d = order.cashCreatedAt || order.createdAt;
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
  const printedCount = todayOrders.filter((o) => o.status === 'printed' || o.status === 'done').length;
  const pendingCount = todayOrders.filter((o) => o.status !== 'printed' && o.status !== 'done').length;

  if (loading) return <h2 style={{ textAlign: 'center' }}>Loading Orders...</h2>;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Falguni Xerox - Admin Dashboard</h1>

      <div style={cards}>
        <Card title="Today Collection" value={`₹${totalCollection}`} />
        <Card title="Cash" value={`₹${cashTotal}`} />
        <Card title="Online" value={`₹${onlineTotal}`} />
        <Card title="Total Jobs" value={todayOrders.length} />
        <Card title="Printed" value={printedCount} />
        <Card title="Pending" value={pendingCount} />
      </div>

      <button onClick={fetchOrders} style={btnGreen}>Refresh</button>
      <span style={{ marginLeft: 15, color: '#666' }}>Last update: {lastUpdated}</span>

      {orders.length === 0 ? (
        <p>No orders found</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ background: '#0a8f08', color: 'white' }}>
                <th style={th}>Token</th>
                <th style={th}>Time</th>
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
              {orders.map((order) => {
                const jobId = order.jobId || order.id;
                const status = order.status || '-';

                return (
                  <tr key={jobId} style={{ background: getRowColor(status) }}>
                    <td style={td}><b>#{order.token || jobId}</b></td>
                    <td style={td}>{formatTime(order)}</td>
                    <td style={td}>{order.pages || '-'}</td>
                    <td style={td}>{order.copies || 1}</td>
                    <td style={td}>{order.printType || '-'}</td>
                    <td style={td}><b>₹{getAmount(order)}</b></td>
                    <td style={td}>{getPaymentText(order)}</td>
                    <td style={td}><b>{status.toUpperCase()}</b></td>
                    <td style={td}>
                      {status === 'printed' || status === 'done' || status === 'failed' ? (
                        <button onClick={() => reprintOrder(jobId)} disabled={actionLoading !== ''} style={btnBlue}>
                          Reprint
                        </button>
                      ) : (
                        <>
                          <button onClick={() => updateStatus(jobId, 'printed')} disabled={actionLoading !== ''} style={btnGreen}>
                            Mark Printed
                          </button>
                          <button onClick={() => cancelOrder(jobId)} disabled={actionLoading !== ''} style={btnRed}>
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, color: '#666' }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

function formatTime(order) {
  const value = order.cashCreatedAt || order.createdAt || order.time;
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN');
}

function getRowColor(status) {
  if (status === 'printed' || status === 'done') return '#d4edda';
  if (status === 'pending_print') return '#fff3cd';
  if (status === 'failed') return '#f8d7da';
  if (status === 'cancelled') return '#e2e3e5';
  return '#ffffff';
}

const cards = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
  marginBottom: '20px'
};

const card = {
  border: '1px solid #ddd',
  borderRadius: '10px',
  padding: '15px',
  background: '#f8f9fa'
};

const th = { padding: '12px', border: '1px solid #ddd', textAlign: 'left' };
const td = { padding: '10px', border: '1px solid #ddd' };

const btnGreen = {
  background: '#0a8f08',
  color: 'white',
  border: 'none',
  padding: '8px 12px',
  borderRadius: '5px',
  cursor: 'pointer',
  marginRight: '6px',
  fontWeight: 'bold'
};

const btnBlue = { ...btnGreen, background: '#007bff' };
const btnRed = { ...btnGreen, background: '#dc3545' };

export default Admin;