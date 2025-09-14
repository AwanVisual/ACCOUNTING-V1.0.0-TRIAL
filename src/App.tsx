import React, { useState, useMemo, FC, useCallback, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Edit, Trash2, Search, XCircle, ChevronUp, ChevronDown, Download, BookOpen, Settings, Loader2, Upload, FileDown, ArrowLeft, Building, Copy } from 'lucide-react';
import { PDFDownloadLink, Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// --- TYPE DEFINITIONS & GLOBAL DECLARATIONS ---
declare global {
    interface Window {
        supabase: { createClient: (url: string, key: string) => SupabaseClient; };
        XLSX: any;
    }
}

interface SupabaseClient {
    from: (table: string) => any;
    channel: (name: string) => any;
    removeChannel: (channel: any) => any;
}

type TransactionType = 'debit' | 'credit';
type AccountCategory = 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_sales' | 'other_income' | 'other_expense';

interface Company {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    npwp?: string;
    fiscalYearStart?: string;
    fiscalYearEnd?: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  accountId: string;
  type: TransactionType;
  amount: number;
}

interface Account {
  id: string;
  name: string;
  category: AccountCategory;
  normalBalance: TransactionType;
  beginningBalance: number;
}

// --- SUPABASE SETUP ---
const SUPABASE_URL = 'https://uqruoxqwltoppskiyijm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcnVveHF3bHRvcHBza2l5aWptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NDk4NjIsImV4cCI6MjA3MzQyNTg2Mn0.vUA4Efuov1W22BGagxwn7Xt3DNQxQ4H7XzhixJ-C3NE';

// --- CONSTANTS ---
const PPN_RATE = 0.11;
const PPH23_RATE = 0.02;

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
const getAccountName = (accountId: string, accounts: Account[]) => accounts.find(acc => acc.id === accountId)?.name || 'Akun tidak ditemukan';
const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(`${dateString}T00:00:00`);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return 'Invalid Date';
    }
};

// --- PDF TEMPLATE COMPONENTS ---
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 'normal' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 'bold' },
  ]
});

const styles = StyleSheet.create({
    page: { fontFamily: 'Roboto', fontSize: 10, paddingTop: 35, paddingBottom: 65, paddingHorizontal: 35, backgroundColor: '#FFFFFF' },
    header: { marginBottom: 20, textAlign: 'center' },
    companyName: { fontSize: 16, fontWeight: 'bold', color: '#1a237e' },
    reportTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 4, color: '#37474f' },
    period: { fontSize: 10, color: 'grey', marginTop: 2 },
    table: { width: '100%' },
    tableRow: { flexDirection: 'row', borderBottomColor: '#eeeeee', borderBottomWidth: 1, alignItems: 'center', minHeight: 24 },
    tableHeader: { backgroundColor: '#f5f5f5', fontWeight: 'bold' },
    tableCol: { width: '70%', padding: 5 },
    tableColAmount: { width: '30%', textAlign: 'right', padding: 5 },
    totalRow: { borderTopWidth: 1, borderTopColor: '#424242', fontWeight: 'bold' },
    highlightRow: { backgroundColor: '#e3f2fd', fontWeight: 'bold' },
    footer: { position: 'absolute', bottom: 30, left: 35, right: 35, textAlign: 'center', color: 'grey', fontSize: 9 }
});

interface LaporanPdfProps {
    company: Company;
    title: string;
    period: string;
    data: {
        sections: {
            title: string;
            items: { label: string; amount: number }[];
            totalLabel: string;
            totalAmount: number;
        }[];
        finalLabel: string;
        finalAmount: number;
    }
}

const LaporanPdfTemplate: FC<LaporanPdfProps> = ({ company, title, period, data }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.companyName}>{company.name.toUpperCase()}</Text>
                <Text style={styles.reportTitle}>{title}</Text>
                <Text style={styles.period}>{period}</Text>
            </View>
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.tableCol}>Keterangan</Text>
                    <Text style={styles.tableColAmount}>Jumlah (IDR)</Text>
                </View>
                {data.sections.map((section, idx) => (
                    <View key={idx}>
                        <View style={[styles.tableRow, { backgroundColor: '#fafafa' }]}>
                            <Text style={[styles.tableCol, { fontWeight: 'bold' }]}>{section.title.toUpperCase()}</Text>
                            <Text style={styles.tableColAmount}></Text>
                        </View>
                        {section.items.map((item, itemIdx) => (
                            <View style={styles.tableRow} key={itemIdx}>
                                <Text style={styles.tableCol}>{`  ${item.label}`}</Text>
                                <Text style={styles.tableColAmount}>{formatCurrency(item.amount)}</Text>
                            </View>
                        ))}
                        <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={styles.tableCol}>{section.totalLabel}</Text>
                            <Text style={styles.tableColAmount}>{formatCurrency(section.totalAmount)}</Text>
                        </View>
                         <View style={styles.tableRow}><Text> </Text></View>
                    </View>
                ))}
                <View style={[styles.tableRow, styles.highlightRow, styles.totalRow]}>
                    <Text style={styles.tableCol}>{data.finalLabel}</Text>
                    <Text style={styles.tableColAmount}>{formatCurrency(data.finalAmount)}</Text>
                </View>
            </View>
            <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
    </Document>
);

interface LaporanKeuanganPdfProps {
    company: Company;
    pnlData: LaporanPdfProps['data'];
    neracaData: LaporanPdfProps['data'];
    period: string;
    neracaDate: string;
}

const LaporanKeuanganPdf: FC<LaporanKeuanganPdfProps> = ({ company, pnlData, neracaData, period, neracaDate }) => {
    const renderReportPage = (title: string, reportPeriod: string, data: LaporanPdfProps['data']) => (
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.companyName}>{company.name.toUpperCase()}</Text>
                <Text style={styles.reportTitle}>{title}</Text>
                <Text style={styles.period}>{reportPeriod}</Text>
            </View>
            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.tableCol}>Keterangan</Text>
                    <Text style={styles.tableColAmount}>Jumlah (IDR)</Text>
                </View>
                {data.sections.map((section, idx) => (
                    <View key={idx}>
                        <View style={[styles.tableRow, { backgroundColor: '#fafafa' }]}>
                            <Text style={[styles.tableCol, { fontWeight: 'bold' }]}>{section.title.toUpperCase()}</Text>
                            <Text style={styles.tableColAmount}></Text>
                        </View>
                        {section.items.map((item, itemIdx) => (
                            <View style={styles.tableRow} key={itemIdx}>
                                <Text style={styles.tableCol}>{`  ${item.label}`}</Text>
                                <Text style={styles.tableColAmount}>{formatCurrency(item.amount)}</Text>
                            </View>
                        ))}
                        <View style={[styles.tableRow, styles.totalRow]}>
                            <Text style={styles.tableCol}>{section.totalLabel}</Text>
                            <Text style={styles.tableColAmount}>{formatCurrency(section.totalAmount)}</Text>
                        </View>
                         <View style={styles.tableRow}><Text> </Text></View>
                    </View>
                ))}
                <View style={[styles.tableRow, styles.highlightRow, styles.totalRow]}>
                    <Text style={styles.tableCol}>{data.finalLabel}</Text>
                    <Text style={styles.tableColAmount}>{formatCurrency(data.finalAmount)}</Text>
                </View>
            </View>
            <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
    );

    return (
        <Document>
            {renderReportPage("Laporan Laba Rugi", period, pnlData)}
            {renderReportPage("Neraca", neracaDate, neracaData)}
        </Document>
    );
};

// Di bawah komponen LaporanKeuanganPdf

const stylesJurnal = StyleSheet.create({
    page: { fontFamily: 'Roboto', fontSize: 9, paddingTop: 35, paddingBottom: 65, paddingHorizontal: 35 },
    headerText: { textAlign: 'center', marginBottom: 20 },
    companyName: { fontSize: 14, fontWeight: 'bold' },
    reportTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
    period: { fontSize: 9, color: 'grey', marginTop: 2 },
    table: { width: '100%' },
    tableRow: { flexDirection: 'row', borderBottomColor: '#cccccc', borderBottomWidth: 1, alignItems: 'center', minHeight: 24 },
    tableHeader: { backgroundColor: '#f2f2f2', fontWeight: 'bold' },
    colDate: { width: '15%', padding: 4 },
    colDesc: { width: '35%', padding: 4 },
    colAcc: { width: '20%', padding: 4 },
    colAmount: { width: '15%', textAlign: 'right', padding: 4 },
    footer: { position: 'absolute', bottom: 30, left: 35, right: 35, textAlign: 'center', color: 'grey', fontSize: 9 }
});

// Tipe data baru untuk ringkasan
interface LedgerSummaryData {
    accountId: string;
    accountName: string;
    beginningBalance: number;
    totalDebit: number;
    totalCredit: number;
    endingBalance: number;
}

// Template PDF baru untuk mencetak tabel ringkasan
const TrialBalancePdf: FC<{ company: Company; summaryData: LedgerSummaryData[] }> = ({ company, summaryData }) => (
    <Document>
        <Page size="A4" style={stylesJurnal.page} orientation="landscape">
            <View style={stylesJurnal.headerText}>
                <Text style={stylesJurnal.companyName}>{company.name.toUpperCase()}</Text>
                <Text style={stylesJurnal.reportTitle}>Ringkasan Saldo Akun (Neraca Lajur)</Text>
                <Text style={stylesJurnal.period}>{`Periode ${formatDate(company.fiscalYearStart)} - ${formatDate(company.fiscalYearEnd)}`}</Text>
            </View>
            <View style={stylesJurnal.table}>
                <View style={[stylesJurnal.tableRow, stylesJurnal.tableHeader]}>
                    <Text style={{width: '25%', padding: 4}}>Akun</Text>
                    <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>Saldo Awal</Text>
                    <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>Debit</Text>
                    <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>Kredit</Text>
                    <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>Saldo Akhir</Text>
                </View>
                {summaryData.map(acc => (
                     <View key={acc.accountId} style={stylesJurnal.tableRow} wrap={false}>
                        <Text style={{width: '25%', padding: 4}}>{`${acc.accountId} - ${acc.accountName}`}</Text>
                        <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>{formatCurrency(acc.beginningBalance)}</Text>
                        <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>{formatCurrency(acc.totalDebit)}</Text>
                        <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>{formatCurrency(acc.totalCredit)}</Text>
                        <Text style={{width: '18.75%', padding: 4, textAlign: 'right'}}>{formatCurrency(acc.endingBalance)}</Text>
                    </View>
                ))}
            </View>
            <Text style={stylesJurnal.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
    </Document>
);



const JurnalUmumPdf: FC<{ company: Company; transactions: Transaction[], accounts: Account[] }> = ({ company, transactions, accounts }) => (
    <Document>
        <Page size="A4" style={stylesJurnal.page} orientation="landscape">
            <View style={stylesJurnal.headerText}>
                <Text style={stylesJurnal.companyName}>{company.name.toUpperCase()}</Text>
                <Text style={stylesJurnal.reportTitle}>Jurnal Umum</Text>
                <Text style={stylesJurnal.period}>{`Periode ${formatDate(company.fiscalYearStart)} - ${formatDate(company.fiscalYearEnd)}`}</Text>
            </View>
            <View style={stylesJurnal.table}>
                <View style={[stylesJurnal.tableRow, stylesJurnal.tableHeader]}>
                    <Text style={stylesJurnal.colDate}>Tanggal</Text>
                    <Text style={stylesJurnal.colDesc}>Keterangan</Text>
                    <Text style={stylesJurnal.colAcc}>Akun</Text>
                    <Text style={stylesJurnal.colAmount}>Debet</Text>
                    <Text style={stylesJurnal.colAmount}>Kredit</Text>
                </View>
                {transactions.map(tx => (
                    <View key={tx.id} style={stylesJurnal.tableRow} wrap={false}>
                        <Text style={stylesJurnal.colDate}>{formatDate(tx.date)}</Text>
                        <Text style={stylesJurnal.colDesc}>{tx.description}</Text>
                        <Text style={stylesJurnal.colAcc}>{getAccountName(tx.accountId, accounts)} ({tx.accountId})</Text>
                        <Text style={stylesJurnal.colAmount}>{tx.type === 'debit' ? formatCurrency(tx.amount) : '-'}</Text>
                        <Text style={stylesJurnal.colAmount}>{tx.type === 'credit' ? formatCurrency(tx.amount) : '-'}</Text>
                    </View>
                ))}
            </View>
            <Text style={stylesJurnal.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
    </Document>
);

const BukuBesarPdf: FC<{ company: Company; entries: (Transaction & { balance: number })[]; account: Account | undefined }> = ({ company, entries, account }) => (
    <Document>
        <Page size="A4" style={stylesJurnal.page} orientation="landscape">
            {/* Header Dokumen */}
            <View style={stylesJurnal.headerText}>
                <Text style={stylesJurnal.companyName}>{company.name.toUpperCase()}</Text>
                <Text style={stylesJurnal.reportTitle}>Buku Besar</Text>
                <Text style={stylesJurnal.period}>{`Akun: ${account?.name || ''} (${account?.id || ''})`}</Text>
            </View>
            
            {/* Tabel Konten */}
            <View style={stylesJurnal.table}>
                {/* Header Tabel */}
                <View style={[stylesJurnal.tableRow, stylesJurnal.tableHeader]}>
                    <Text style={stylesJurnal.colDate}>Tanggal</Text>
                    <Text style={stylesJurnal.colDesc}>Deskripsi</Text>
                    <Text style={stylesJurnal.colAmount}>Debet</Text>
                    <Text style={stylesJurnal.colAmount}>Kredit</Text>
                    <Text style={stylesJurnal.colAmount}>Saldo</Text>
                </View>
                
                {/* Isi Tabel (Data Transaksi) */}
                {entries.map(entry => (
                    <View key={entry.id} style={stylesJurnal.tableRow} wrap={false}>
                        <Text style={stylesJurnal.colDate}>{formatDate(entry.date)}</Text>
                        <Text style={stylesJurnal.colDesc}>{entry.description}</Text>
                        <Text style={stylesJurnal.colAmount}>{entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}</Text>
                        <Text style={stylesJurnal.colAmount}>{entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}</Text>
                        <Text style={stylesJurnal.colAmount}>{formatCurrency(entry.balance)}</Text>
                    </View>
                ))}
            </View>

            {/* Footer Halaman */}
            <Text style={stylesJurnal.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
    </Document>
);

// --- UI COMPONENTS ---
const StatCard: FC<{ title: string; value: string; }> = ({ title, value }) => ( <div className="bg-white p-6 rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-1"> <h3 className="text-sm font-medium text-gray-500">{title}</h3> <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p> </div> );

const Dashboard: FC<{ transactions: Transaction[], accounts: Account[] }> = ({ transactions, accounts }) => {
    const { totalPendapatan, totalBeban, labaRugi, kas } = useMemo(() => {
        let totalPendapatan = 0, totalBeban = 0, kas = 0;
        transactions.forEach(tx => { const account = accounts.find(acc => acc.id === tx.accountId); if (!account) return; const amount = tx.type === account.normalBalance ? tx.amount : -tx.amount; if (account.category === 'income') totalPendapatan += amount; if (account.category === 'expense') totalBeban -= amount; if (account.id === '1-1130') kas += amount; });
        return { totalPendapatan, totalBeban, labaRugi: totalPendapatan - totalBeban, kas };
    }, [transactions, accounts]);
    const chartData = useMemo(() => {
        const monthlyData: { [key: string]: { month: string; pendapatan: number; beban: number } } = {};
        transactions.forEach(tx => { const month = new Date(tx.date).toLocaleString('id-ID', { month: 'short', year: 'numeric' }); if (!monthlyData[month]) monthlyData[month] = { month, pendapatan: 0, beban: 0 }; const account = accounts.find(acc => acc.id === tx.accountId); if (!account) return; if (account.category === 'income') monthlyData[month].pendapatan += tx.amount; else if (account.category === 'expense') monthlyData[month].beban += tx.amount; });
        return Object.values(monthlyData);
    }, [transactions, accounts]);
    return ( <div className="space-y-6"> <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCard title="Total Pendapatan" value={formatCurrency(totalPendapatan)} /><StatCard title="Total Beban" value={formatCurrency(totalBeban)} /><StatCard title="Laba / Rugi Bersih" value={formatCurrency(labaRugi)} /><StatCard title="Kas & Setara Kas" value={formatCurrency(kas)} /></div> <div className="bg-white p-6 rounded-xl shadow-md"><h3 className="text-lg font-semibold text-gray-700 mb-4">Ringkasan Pendapatan vs Beban</h3><div style={{ width: '100%', height: 300 }}><ResponsiveContainer><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value as number)} /><Tooltip formatter={(value) => formatCurrency(value as number)} /><Legend /><Bar dataKey="pendapatan" fill="#34d399" name="Pendapatan" /><Bar dataKey="beban" fill="#f87171" name="Beban" /></BarChart></ResponsiveContainer></div></div> </div> );
};

const TransactionTable: FC<{ transactions: Transaction[], accounts: Account[]; onEdit: (tx: Transaction) => void; onDeleteRequest: (id: string) => void; }> = ({ transactions, accounts, onEdit, onDeleteRequest }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof Transaction; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    const sortedTransactions = useMemo(() => { let sortableItems = [...transactions]; if (sortConfig) sortableItems.sort((a, b) => { if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); return sortableItems; }, [transactions, sortConfig]);
    const requestSort = (key: keyof Transaction) => setSortConfig(prev => ({ key, direction: prev && prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    const SortableHeader: FC<{ columnKey: keyof Transaction; title: string }> = ({ columnKey, title }) => (<th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => requestSort(columnKey)}><div className="flex items-center">{title}{sortConfig?.key === columnKey && (sortConfig.direction === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />)}</div></th>);
    return (<div className="overflow-x-auto bg-white rounded-xl shadow-md"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><SortableHeader columnKey="date" title="Tanggal" /><SortableHeader columnKey="description" title="Deskripsi" /><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Akun</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Debit</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Kredit</th><th className="p-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">Aksi</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedTransactions.map(tx => (<tr key={tx.id} className="hover:bg-gray-50"><td className="p-3 whitespace-nowrap text-sm text-gray-700">{formatDate(tx.date)}</td><td className="p-3 whitespace-nowrap text-sm text-gray-800 font-medium">{tx.description}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700">{getAccountName(tx.accountId, accounts)}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{tx.type === 'debit' ? formatCurrency(tx.amount) : '-'}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{tx.type === 'credit' ? formatCurrency(tx.amount) : '-'}</td><td className="p-3 whitespace-nowrap text-sm text-center"><button onClick={() => onEdit(tx)} className="text-blue-500 hover:text-blue-700 p-1"><Edit size={16} /></button><button onClick={() => onDeleteRequest(tx.id)} className="text-red-500 hover:text-red-700 p-1 ml-2"><Trash2 size={16} /></button></td></tr>))}</tbody></table></div>);
};

const Reports: FC<{ company: Company; transactions: Transaction[], accounts: Account[] }> = ({ company, transactions, accounts }) => {
    const { pnl, balanceSheet, labaBersih, totalAset, totalLiabilitas, totalEkuitas } = useMemo(() => {
        const accountBalances: { [key: string]: number } = {};
        accounts.forEach(acc => accountBalances[acc.id] = 0);
        transactions.forEach(tx => {
            const account = accounts.find(acc => acc.id === tx.accountId);
            if (!account) return;
            accountBalances[tx.accountId] += tx.type === account.normalBalance ? tx.amount : -tx.amount;
        });

        // Logika Laba Rugi yang sudah disesuaikan dengan kategori baru
        const pnl = {
            pendapatan: accounts
                .filter(a => a.category === 'income' || a.category === 'other_income')
                .map(a => ({ name: a.name, amount: accountBalances[a.id] || 0 })),
            beban: accounts
                .filter(a => a.category === 'expense' || a.category === 'cost_of_sales' || a.category === 'other_expense')
                .map(a => ({ name: a.name, amount: accountBalances[a.id] || 0 }))
        };
        const labaBersih = pnl.pendapatan.reduce((s, i) => s + i.amount, 0) - pnl.beban.reduce((s, i) => s + i.amount, 0);
        
        const labaDitahanAcc = accounts.find(a => a.id === '3-9999');
        if (labaDitahanAcc) {
            accountBalances['3-9999'] = (accountBalances['3-9999'] || 0) + labaBersih;
        }
        
        const balanceSheet = {
            aset: accounts.filter(a => a.category === 'asset').map(a => ({ name: a.name, amount: accountBalances[a.id] || 0 })),
            liabilitas: accounts.filter(a => a.category === 'liability').map(a => ({ name: a.name, amount: accountBalances[a.id] || 0 })),
            ekuitas: accounts.filter(a => a.category === 'equity').map(a => ({ name: a.name, amount: accountBalances[a.id] || 0 }))
        };
        const totalAset = balanceSheet.aset.reduce((s, i) => s + i.amount, 0);
        const totalLiabilitas = balanceSheet.liabilitas.reduce((s, i) => s + i.amount, 0);
        const totalEkuitas = balanceSheet.ekuitas.reduce((s, i) => s + i.amount, 0);
        
        return { pnl, balanceSheet, labaBersih, totalAset, totalLiabilitas, totalEkuitas };
    }, [transactions, accounts]);

    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    
    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        setExportError('');
        try {
            if (!window.XLSX) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("Gagal memuat library export."));
                    document.head.appendChild(script);
                });
            }
            const period = `PERIODE ${formatDate(company.fiscalYearStart)} - ${formatDate(company.fiscalYearEnd)}`;
            const labaRugiData = [ { A: company.name.toUpperCase() }, { A: company.address || '' }, { A: 'LAPORAN LABA RUGI' }, { A: period }, {}, { A: 'Keterangan', B: 'Jumlah (IDR)' }, { A: 'PENDAPATAN' }, ...pnl.pendapatan.map(i => ({ A: `  ${i.name}`, B: i.amount })), { A: 'TOTAL PENDAPATAN', B: pnl.pendapatan.reduce((s, i) => s + i.amount, 0) }, { A: '' }, { A: 'BEBAN' }, ...pnl.beban.map(i => ({ A: `  ${i.name}`, B: i.amount })), { A: 'TOTAL BEBAN', B: pnl.beban.reduce((s, i) => s + i.amount, 0) }, { A: '' }, { A: 'LABA / RUGI BERSIH', B: labaBersih }];
            const neracaData = [ { A: company.name.toUpperCase() }, { A: company.address || '' }, { A: 'NERACA' }, { A: `PER ${formatDate(company.fiscalYearEnd)}`}, {}, { A: 'Keterangan', B: 'Jumlah (IDR)' }, { A: 'ASET' }, ...balanceSheet.aset.map(i => ({ A: `  ${i.name}`, B: i.amount })), { A: 'TOTAL ASET', B: totalAset }, { A: '' }, { A: 'LIABILITAS' }, ...balanceSheet.liabilitas.map(i => ({ A: `  ${i.name}`, B: i.amount })), { A: 'TOTAL LIABILITAS', B: totalLiabilitas }, { A: '' }, { A: 'EKUITAS' }, ...balanceSheet.ekuitas.map(i => ({ A: `  ${i.name}`, B: i.amount })), { A: 'TOTAL EKUITAS', B: totalEkuitas }, { A: '' }, { A: 'TOTAL LIABILITAS & EKUITAS', B: totalLiabilitas + totalEkuitas }];
            const wb = window.XLSX.utils.book_new();
            const wsLR = window.XLSX.utils.json_to_sheet(labaRugiData, { skipHeader: true });
            const wsNeraca = window.XLSX.utils.json_to_sheet(neracaData, { skipHeader: true });
            wsLR['!cols'] = [{ wch: 40 }, { wch: 20 }];
            wsNeraca['!cols'] = [{ wch: 40 }, { wch: 20 }];
            window.XLSX.utils.book_append_sheet(wb, wsLR, "Laba Rugi");
            window.XLSX.utils.book_append_sheet(wb, wsNeraca, "Neraca");
            window.XLSX.writeFile(wb, `Laporan Keuangan - ${company.name} - ${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (error) {
            setExportError((error as Error).message || "Terjadi kesalahan saat mengekspor.");
        } finally {
            setIsExporting(false);
        }
    }, [pnl, balanceSheet, labaBersih, totalAset, totalLiabilitas, totalEkuitas, company]);

    const getLabaRugiPdfData = () => ({
        sections: [
            { title: 'Pendapatan', items: pnl.pendapatan.map(i => ({ label: i.name, amount: i.amount })), totalLabel: 'Total Pendapatan', totalAmount: pnl.pendapatan.reduce((s, i) => s + i.amount, 0), },
            { title: 'Beban', items: pnl.beban.map(i => ({ label: i.name, amount: i.amount })), totalLabel: 'Total Beban', totalAmount: pnl.beban.reduce((s, i) => s + i.amount, 0), }
        ],
        finalLabel: 'Laba / Rugi Bersih', finalAmount: labaBersih
    });
    
    const getNeracaPdfData = () => ({
        sections: [
            { title: 'Aset', items: balanceSheet.aset.map(i => ({ label: i.name, amount: i.amount })), totalLabel: 'Total Aset', totalAmount: totalAset },
            { title: 'Liabilitas', items: balanceSheet.liabilitas.map(i => ({ label: i.name, amount: i.amount })), totalLabel: 'Total Liabilitas', totalAmount: totalLiabilitas },
            { title: 'Ekuitas', items: balanceSheet.ekuitas.map(i => ({ label: i.name, amount: i.amount })), totalLabel: 'Total Ekuitas', totalAmount: totalEkuitas },
        ],
        finalLabel: 'Total Liabilitas & Ekuitas', finalAmount: totalLiabilitas + totalEkuitas
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-end items-center gap-2">
                {exportError && <p className="text-sm text-red-600 mr-4">{exportError}</p>}
                <PDFDownloadLink
                    document={<LaporanKeuanganPdf company={company} pnlData={getLabaRugiPdfData()} neracaData={getNeracaPdfData()} period={`Periode ${formatDate(company.fiscalYearStart)} - ${formatDate(company.fiscalYearEnd)}`} neracaDate={`Per Tanggal ${formatDate(company.fiscalYearEnd)}`}/>}
                    fileName={`Laporan Keuangan - ${company.name}.pdf`}>
                    {({ loading }) => ( <button disabled={loading} className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors disabled:bg-gray-400"><Download size={18} className="mr-2" />{loading ? 'Membuat PDF...' : 'Ekspor Laporan Keuangan (PDF)'}</button>)}
                </PDFDownloadLink>
                <button onClick={handleExportExcel} disabled={isExporting} className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors disabled:bg-gray-400"><Download size={18} className="mr-2" />{isExporting ? 'Mengekspor...' : 'Ekspor Laporan (Excel)'}</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Laporan Laba Rugi</h3>
                    <p className="text-sm text-gray-500">Periode: {formatDate(company.fiscalYearStart)} - {formatDate(company.fiscalYearEnd)}</p>
                    <div>
                        <h4 className="font-semibold text-gray-600">Pendapatan</h4>
                        {pnl.pendapatan.map(i => <ReportRow key={i.name} label={i.name} amount={i.amount} />)}
                        <ReportRow label="Total Pendapatan" amount={pnl.pendapatan.reduce((s, i) => s + i.amount, 0)} isTotal />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-600">Beban</h4>
                        {pnl.beban.map(i => <ReportRow key={i.name} label={i.name} amount={i.amount} />)}
                        <ReportRow label="Total Beban" amount={pnl.beban.reduce((s, i) => s + i.amount, 0)} isTotal />
                    </div>
                    <ReportRow label="Laba / Rugi Bersih" amount={labaBersih} isTotal highlight />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                    <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Neraca</h3>
                    <p className="text-sm text-gray-500">Per Tanggal: {formatDate(company.fiscalYearEnd)}</p>
                    <div>
                        <h4 className="font-semibold text-gray-600">Aset</h4>
                        {balanceSheet.aset.map(i => <ReportRow key={i.name} label={i.name} amount={i.amount} />)}
                        <ReportRow label="Total Aset" amount={totalAset} isTotal />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-600">Liabilitas</h4>
                        {balanceSheet.liabilitas.map(i => <ReportRow key={i.name} label={i.name} amount={i.amount} />)}
                        <ReportRow label="Total Liabilitas" amount={totalLiabilitas} isTotal />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-600">Ekuitas</h4>
                        {balanceSheet.ekuitas.map(i => <ReportRow key={i.name} label={i.name} amount={i.amount} />)}
                        <ReportRow label="Total Ekuitas" amount={totalEkuitas} isTotal />
                    </div>
                    <ReportRow label="Total Liabilitas & Ekuitas" amount={totalLiabilitas + totalEkuitas} isTotal highlight />
                </div>
            </div>
        </div>
    );
};

const JurnalUmum: FC<{ company: Company; transactions: Transaction[], accounts: Account[] }> = ({ company, transactions, accounts }) => {
    const sortedTransactions = useMemo(() => [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [transactions]);
    const [isExporting, setIsExporting] = useState(false);
    const handleExportExcel = useCallback(async () => { setIsExporting(true); try { if (!window.XLSX) { await new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Gagal memuat library export.")); document.head.appendChild(script); }); } const period = `Januari - Desember ${new Date(company.fiscalYearEnd || new Date()).getFullYear()}`; const dataToExport = [ { A: 'LAPORAN KEUANGAN' }, { A: company.name.toUpperCase() }, { A: company.address?.toUpperCase() || 'DENPASAR' }, { A: period }, {}, { A: 'No.', B: 'Tanggal', C: 'Keterangan', D: 'Debet', E: 'Kredit' } ]; sortedTransactions.forEach((tx, index) => { dataToExport.push({ A: index + 1, B: formatDate(tx.date), C: tx.description, D: tx.type === 'debit' ? tx.amount : '', E: tx.type === 'credit' ? tx.amount : '', }); }); const wb = window.XLSX.utils.book_new(); const ws = window.XLSX.utils.json_to_sheet(dataToExport, { skipHeader: true }); ws['!cols'] = [ { wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, ]; window.XLSX.utils.book_append_sheet(wb, ws, "Jurnal Umum"); window.XLSX.writeFile(wb, `Jurnal Umum - ${company.name} - ${new Date().toISOString().slice(0,10)}.xlsx`); } catch (error) { console.error("Export failed:", error); alert((error as Error).message || "Terjadi kesalahan saat mengekspor."); } finally { setIsExporting(false); } }, [sortedTransactions, company]);
    
    return (
        <div className="space-y-4">
            <div className="flex justify-end items-center gap-2">
                <PDFDownloadLink document={<JurnalUmumPdf company={company} transactions={sortedTransactions} accounts={accounts} />} fileName={`Jurnal Umum - ${company.name}.pdf`}>
                    {({ loading }) => (
                        <button disabled={loading} className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors disabled:bg-gray-400">
                           <Download size={18} className="mr-2" />
                           {loading ? 'Membuat PDF...' : 'Ekspor Jurnal (PDF)'}
                        </button>
                    )}
                </PDFDownloadLink>
                <button onClick={handleExportExcel} disabled={isExporting} className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors disabled:bg-gray-400">
                    <Download size={18} className="mr-2" />
                    {isExporting ? 'Mengekspor...' : 'Ekspor Jurnal (Excel)'}
                </button>
            </div>
            <div className="overflow-x-auto bg-white rounded-xl shadow-md">
                <div className="p-4 border-b"><h2 className="text-xl font-bold text-center text-gray-800">JURNAL UMUM</h2><p className="text-center text-gray-600">{company.name}</p><p className="text-sm text-center text-gray-500">Periode: {formatDate(company.fiscalYearStart)} - {formatDate(company.fiscalYearEnd)}</p></div>
                <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Keterangan</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Akun</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Debet</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Kredit</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{sortedTransactions.map(tx => (<tr key={tx.id} className="hover:bg-gray-50"><td className="p-3 whitespace-nowrap text-sm text-gray-700">{formatDate(tx.date)}</td><td className="p-3 whitespace-nowrap text-sm text-gray-800 font-medium">{tx.description}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700">{getAccountName(tx.accountId, accounts)} ({tx.accountId})</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{tx.type === 'debit' ? formatCurrency(tx.amount) : '-'}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{tx.type === 'credit' ? formatCurrency(tx.amount) : '-'}</td></tr>))}</tbody></table>
            </div>
        </div>
    );
};

const GeneralLedger: FC<{ company: Company; transactions: Transaction[], accounts: Account[] }> = ({ company, transactions, accounts }) => {
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    
    const ledgerData = useMemo(() => {
        if (!selectedAccountId) return null;

        // KASUS 1: Tampilkan Ringkasan Semua Akun
        if (selectedAccountId === 'all') {
            const startDate = new Date(`${company.fiscalYearStart}T00:00:00`);
            const summaryData: LedgerSummaryData[] = [];
            
            // Ambil semua akun yang punya saldo awal atau punya transaksi
            const accountsToProcess = accounts.filter(acc => 
                acc.beginningBalance !== 0 || transactions.some(tx => tx.accountId === acc.id)
            );

            for (const account of accountsToProcess) {
                // Perhitungan Saldo Awal dimulai dari data saldo awal di akun
                let beginningBalance = account.beginningBalance;
                let totalDebit = 0;
                let totalCredit = 0;

                const allAccountTx = transactions.filter(tx => tx.accountId === account.id);

                for (const tx of allAccountTx) {
                    const txDate = new Date(`${tx.date}T00:00:00`);
                    const amountChange = tx.type === account.normalBalance ? tx.amount : -tx.amount;
                    
                    // Tambahkan mutasi sebelum periode fiskal ke saldo awal
                    if (txDate < startDate) {
                        beginningBalance += amountChange;
                    } else { // Transaksi di dalam periode dihitung sebagai mutasi
                        if (tx.type === 'debit') totalDebit += tx.amount;
                        if (tx.type === 'credit') totalCredit += tx.amount;
                    }
                }
                
                const mutationChange = account.normalBalance === 'debit' ? totalDebit - totalCredit : totalCredit - totalDebit;
                const endingBalance = beginningBalance + mutationChange;
                
                summaryData.push({
                    accountId: account.id,
                    accountName: account.name,
                    beginningBalance,
                    totalDebit,
                    totalCredit,
                    endingBalance
                });
            }
            return summaryData;
        }

        // KASUS 2: Tampilkan Detail Satu Akun
        const account = accounts.find(acc => acc.id === selectedAccountId);
        if (!account) return [];

        const filteredTx = transactions.filter(tx => tx.accountId === selectedAccountId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Perhitungan saldo berjalan juga dimulai dari saldo awal akun
        let runningBalance = account.beginningBalance;

        return filteredTx.map(tx => {
            const amountChange = tx.type === account.normalBalance ? tx.amount : -tx.amount;
            runningBalance += amountChange;
            return { ...tx, balance: runningBalance };
        });
    }, [selectedAccountId, transactions, accounts, company.fiscalYearStart]);

    const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [selectedAccountId, accounts]);
    
    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-md flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full sm:w-1/2 lg:w-1/3">
                    <label htmlFor="account-select" className="block text-sm font-medium text-gray-700 mb-1">Pilih Akun</label>
                    <select id="account-select" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="">-- Tampilkan Mutasi Akun --</option>
                        <option value="all">-- Tampilkan Semua Mutasi --</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>)}
                    </select>
                </div>
                <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                    {selectedAccountId && (
                        <PDFDownloadLink
                            document={
                                selectedAccountId === 'all' 
                                ? <TrialBalancePdf company={company} summaryData={ledgerData as LedgerSummaryData[]} />
                                : <BukuBesarPdf company={company} entries={ledgerData as (Transaction & { balance: number })[]} account={selectedAccount} />
                            }
                            fileName={`Buku Besar - ${selectedAccountId === 'all' ? 'Ringkasan Saldo' : selectedAccount?.name}.pdf`}
                        >
                            {({ loading }) => (
                                <button disabled={loading} className="w-full sm:w-auto flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors disabled:bg-gray-400">
                                   <Download size={18} className="mr-2" />
                                   {loading ? 'Membuat PDF...' : 'Ekspor (PDF)'}
                                </button>
                            )}
                        </PDFDownloadLink>
                    )}
                </div>
            </div>

            {selectedAccountId && ledgerData && (
                selectedAccountId === 'all'
                    ? (
                        <div className="bg-white rounded-xl shadow-md p-4">
                            <h3 className="text-lg font-semibold text-gray-700 mb-3">Ringkasan Saldo Akun (Neraca Lajur)</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-2 text-left font-semibold text-gray-600">Akun</th>
                                            <th className="p-2 text-right font-semibold text-gray-600">Saldo Awal</th>
                                            <th className="p-2 text-right font-semibold text-gray-600">Mutasi Debit</th>
                                            <th className="p-2 text-right font-semibold text-gray-600">Mutasi Kredit</th>
                                            <th className="p-2 text-right font-semibold text-gray-600">Saldo Akhir</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {(ledgerData as LedgerSummaryData[]).map((acc: LedgerSummaryData) => (
                                            <tr key={acc.accountId}>
                                                <td className="p-2 whitespace-nowrap">{acc.accountId} - {acc.accountName}</td>
                                                <td className="p-2 whitespace-nowrap text-right">{formatCurrency(acc.beginningBalance)}</td>
                                                <td className="p-2 whitespace-nowrap text-right text-green-600">{formatCurrency(acc.totalDebit)}</td>
                                                <td className="p-2 whitespace-nowrap text-right text-red-600">{formatCurrency(acc.totalCredit)}</td>
                                                <td className="p-2 whitespace-nowrap text-right font-bold">{formatCurrency(acc.endingBalance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                    : <LedgerTable entries={ledgerData as (Transaction & { balance: number })[]} />
            )}
        </div>
    );
};

const ReportRow: FC<{ label: string; amount: number; isTotal?: boolean; highlight?: boolean }> = ({ label, amount, isTotal = false, highlight = false }) => (<div className={`flex justify-between py-1 ${isTotal ? 'border-t mt-1 pt-1' : ''} ${highlight ? 'font-bold text-blue-600' : ''}`}><span className="text-sm text-gray-600">{label}</span><span className="text-sm text-gray-800">{formatCurrency(amount)}</span></div>);
const LedgerTable: FC<{ entries: (Transaction & { balance: number })[] }> = ({ entries }) => (<div className="overflow-x-auto bg-white rounded-xl shadow-md mt-4"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Tanggal</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Deskripsi</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Debit</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Kredit</th><th className="p-3 text-right text-sm font-semibold text-gray-600 uppercase tracking-wider">Saldo</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{entries.map(entry => (<tr key={entry.id} className="hover:bg-gray-50"><td className="p-3 whitespace-nowrap text-sm text-gray-700">{formatDate(entry.date)}</td><td className="p-3 whitespace-nowrap text-sm text-gray-800 font-medium">{entry.description}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{entry.type === 'debit' ? formatCurrency(entry.amount) : '-'}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">{entry.type === 'credit' ? formatCurrency(entry.amount) : '-'}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right font-semibold">{formatCurrency(entry.balance)}</td></tr>))}</tbody></table></div>);
const AccountManagement: FC<{ company: Company, accounts: Account[]; transactions: Transaction[]; onSave: (account: Account) => Promise<void>; onDeleteRequest: (accountId: string) => void; }> = ({ company, accounts, transactions, onSave, onDeleteRequest }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const isAccountInUse = useCallback((accountId: string) => transactions.some(tx => tx.accountId === accountId), [transactions]);
    const handleSave = async (account: Account) => { await onSave(account); setIsModalOpen(false); };
    return (
        <div className="space-y-4">
            <div className="flex justify-end"><button onClick={() => { setEditingAccount(null); setIsModalOpen(true); }} className="flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors"><Plus size={18} className="mr-2" />Tambah Akun Baru</button></div>
            <div className="overflow-x-auto bg-white rounded-xl shadow-md">
                <table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">ID Akun</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Nama Akun</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Kategori</th><th className="p-3 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">Saldo Normal</th><th className="p-3 text-center text-sm font-semibold text-gray-600 uppercase tracking-wider">Aksi</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{accounts.map(acc => (<tr key={`${acc.id}-${company.id}`} className="hover:bg-gray-50"><td className="p-3 whitespace-nowrap text-sm text-gray-800 font-medium">{acc.id}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700">{acc.name}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 capitalize">{acc.category}</td><td className="p-3 whitespace-nowrap text-sm text-gray-700 capitalize">{acc.normalBalance}</td><td className="p-3 whitespace-nowrap text-sm text-center"><button onClick={() => { setEditingAccount(acc); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 p-1"><Edit size={16} /></button><button onClick={() => onDeleteRequest(acc.id)} disabled={isAccountInUse(acc.id)} className="text-red-500 hover:text-red-700 p-1 ml-2 disabled:text-gray-300 disabled:cursor-not-allowed" title={isAccountInUse(acc.id) ? 'Akun tidak bisa dihapus karena sudah digunakan dalam transaksi' : 'Hapus akun'}><Trash2 size={16} /></button></td></tr>))}</tbody></table>
            </div>
            <AccountModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} existingAccount={editingAccount} allAccounts={accounts} />
        </div>
    );
};
const ConfirmationModal: FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; }> = ({ isOpen, onClose, onConfirm, title, message }) => { if (!isOpen) return null; return (<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-md"><div className="p-6"><h3 className="text-lg font-semibold text-gray-800">{title}</h3><p className="mt-2 text-sm text-gray-600">{message}</p></div><div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300">Batal</button><button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Hapus</button></div></div></div>); };

// Di bawah komponen ConfirmationModal

const ImportConfirmationModal: FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; }> = ({ isOpen, onClose, onConfirm }) => {
    const [isChecked, setIsChecked] = useState(false);

    // Reset checkbox setiap kali modal dibuka
    useEffect(() => {
        if (isOpen) {
            setIsChecked(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800">Peringatan Sebelum Import Transaksi</h3>
                    <p className="mt-2 text-sm text-gray-600">
                        Pastikan file Excel (.xlsx) yang akan Anda import sudah sesuai dengan format template. File harus memiliki kolom dengan nama persis sebagai berikut:
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm space-y-1 bg-gray-50 p-3 rounded-md">
                        <li><code className="font-mono text-blue-600">date</code> (Format: YYYY-MM-DD, contoh: 2025-09-14)</li>
                        <li><code className="font-mono text-blue-600">description</code> (Teks deskripsi transaksi)</li>
                        <li><code className="font-mono text-blue-600">account_id</code> (ID Akun yang sesuai, contoh: 1-1130)</li>
                        <li><code className="font-mono text-blue-600">debit</code> (Jumlah debit, isi 0 jika tidak ada)</li>
                        <li><code className="font-mono text-blue-600">credit</code> (Jumlah kredit, isi 0 jika tidak ada)</li>
                    </ul>
                     <p className="mt-3 text-xs text-gray-500">
                        Setiap baris di file Excel akan dianggap sebagai satu entri transaksi. Pastikan total debit dan kredit seimbang untuk setiap jurnal/transaksi yang berkaitan.
                    </p>

                    {/* --- PERINGATAN UTAMA YANG DITAMBAHKAN --- */}
                    <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-800">
                        <p className="font-bold text-center">
                            PENTING: Pastikan Anda sudah membuat semua Akun dengan nomor (account_id) yang sesuai sebelum mengimport transaksi ini.
                        </p>
                        <p className="text-xs text-center mt-1">
                            Jika `account_id` dalam file Excel tidak ditemukan di daftar akun Anda, import akan gagal atau menyebabkan data tidak akurat.
                        </p>
                    </div>

                    <div className="flex items-center space-x-3 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <input
                            type="checkbox"
                            id="import-confirm-checkbox"
                            checked={isChecked}
                            onChange={(e) => setIsChecked(e.target.checked)}
                            className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="import-confirm-checkbox" className="text-sm font-medium text-yellow-800">
                            Saya mengerti dan format file saya sudah benar.
                        </label>
                    </div>
                </div>
                <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg gap-2">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                        Batal
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!isChecked}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Lanjutkan Import
                    </button>
                </div>
            </div>
        </div>
    );
};


const AccountModal: FC<{ isOpen: boolean; onClose: () => void; onSave: (account: Account) => void; existingAccount: Account | null; allAccounts: Account[] }> = ({ isOpen, onClose, onSave, existingAccount, allAccounts }) => {
    const [account, setAccount] = useState<Account>(existingAccount || { id: '', name: '', category: 'asset', normalBalance: 'debit', beginningBalance: 0 });
    const [error, setError] = useState('');

    useEffect(() => {
        setAccount(existingAccount || { id: '', name: '', category: 'asset', normalBalance: 'debit', beginningBalance: 0 });
        setError('');
    }, [existingAccount, isOpen]);

    // --- LOGIKA OTOMATIS DITAMBAHKAN DI SINI ---
    // useEffect ini akan berjalan setiap kali nilai account.category berubah
    useEffect(() => {
        const debitCategories: AccountCategory[] = ['asset', 'cost_of_sales', 'expense', 'other_expense'];
        
        // Periksa apakah kategori yang dipilih termasuk dalam kategori dengan saldo normal DEBIT
        if (debitCategories.includes(account.category)) {
            // Jika ya, atur saldo normal menjadi 'debit'
            setAccount(prev => ({ ...prev, normalBalance: 'debit' }));
        } else {
            // Jika tidak (artinya liability, equity, income), atur menjadi 'credit'
            setAccount(prev => ({ ...prev, normalBalance: 'credit' }));
        }
    }, [account.category]); // <-- "Pemicu"-nya adalah perubahan kategori

    const handleChange = (field: keyof Account, value: string | number) => {
        setAccount(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        if (!account.id || !account.name) {
            setError('ID Akun dan Nama Akun tidak boleh kosong.');
            return;
        }
        if (!existingAccount && allAccounts.some(acc => acc.id === account.id)) {
            setError('ID Akun sudah ada. Harap gunakan ID yang unik.');
            return;
        }
        onSave(account);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-800">{existingAccount ? 'Edit' : 'Tambah'} Akun</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                    {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm font-medium">{error}</div>}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ID Akun</label>
                        <input type="text" value={account.id} onChange={e => handleChange('id', e.target.value)} disabled={!!existingAccount} className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nama Akun</label>
                        <input type="text" value={account.name} onChange={e => handleChange('name', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Saldo Awal</label>
                        <input 
                            type="number" 
                            value={account.beginningBalance} 
                            onChange={e => handleChange('beginningBalance', parseFloat(e.target.value) || 0)} 
                            className="mt-1 w-full p-2 border rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kategori</label>
                        <select value={account.category} onChange={e => handleChange('category', e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option value="asset">1 - Aset</option>
                            <option value="liability">2 - Liabilitas</option>
                            <option value="equity">3 - Ekuitas</option>
                            <option value="income">4 - Pendapatan (Income)</option>
                            <option value="cost_of_sales">5 - Harga Pokok Penjualan (COGS)</option>
                            <option value="expense">6 - Beban (Expense)</option>
                            <option value="other_income">8 - Pendapatan Lain-lain</option>
                            <option value="other_expense">9 - Beban Lain-lain</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Saldo Normal</label>
                        {/* --- INPUT INI SEKARANG DINONAKTIFKAN (DISABLED) --- */}
                        <select 
                            value={account.normalBalance} 
                            onChange={e => handleChange('normalBalance', e.target.value)} 
                            className="mt-1 w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed"
                            disabled 
                        >
                            <option value="debit">Debit</option>
                            <option value="credit">Kredit</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300">Batal</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Simpan</button>
                </div>
            </div>
        </div>
    );
};



const TransactionModal: FC<{ isOpen: boolean; onClose: () => void; onSave: (entries: Partial<Transaction>[], options?: { kenaPpn?: boolean; potongPph23?: boolean; baseAmount?: number; desc?: string; date?: string}) => void; initialData?: Transaction[] | null; isJurnalUmum: boolean; setIsJurnalUmum: (isJurnal: boolean) => void; allAccounts: Account[] }> = ({ isOpen, onClose, onSave, initialData, isJurnalUmum, setIsJurnalUmum, allAccounts }) => {
    const [simpleDesc, setSimpleDesc] = useState(''); const [simpleAmount, setSimpleAmount] = useState<number>(0); const [simpleDate, setSimpleDate] = useState(new Date().toISOString().split('T')[0]); const [simpleAccountId, setSimpleAccountId] = useState(''); const [kenaPpn, setKenaPpn] = useState(false); const [potongPph23, setPotongPph23] = useState(false); const [transactionNature, setTransactionNature] = useState<'income' | 'expense' | null>(null); const [entries, setEntries] = useState<Partial<Transaction>[]>(initialData || [{ type: 'debit' }, { type: 'credit' }]); const [commonDesc, setCommonDesc] = useState(initialData?.[0]?.description || ''); const [commonDate, setCommonDate] = useState(initialData?.[0]?.date || new Date().toISOString().split('T')[0]); const [error, setError] = useState('');
    useEffect(() => { if (initialData) { setEntries(initialData); setCommonDesc(initialData[0]?.description || ''); setCommonDate(initialData[0]?.date || new Date().toISOString().split('T')[0]); } else { setSimpleDesc(''); setSimpleAmount(0); setSimpleDate(new Date().toISOString().split('T')[0]); setSimpleAccountId(''); setKenaPpn(false); setPotongPph23(false); setTransactionNature(null); setEntries([{ type: 'debit' }, { type: 'credit' }]); setCommonDesc(''); setCommonDate(new Date().toISOString().split('T')[0]); } setError(''); }, [initialData, isOpen]);
    useEffect(() => { const account = allAccounts.find(acc => acc.id === simpleAccountId); if (account) setTransactionNature(account.category === 'income' ? 'income' : account.category === 'expense' ? 'expense' : null); else setTransactionNature(null); }, [simpleAccountId, allAccounts]);
    const handleEntryChange = (index: number, field: keyof Transaction, value: any) => { const newEntries = [...entries]; newEntries[index] = { ...newEntries[index], [field]: value }; setEntries(newEntries); };
    const addEntry = () => setEntries([...entries, {}]); const removeEntry = (index: number) => setEntries(entries.filter((_, i) => i !== index));
    const handleSubmit = () => { setError(''); if (isJurnalUmum) { const totalDebit = entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + (e.amount || 0), 0); const totalCredit = entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + (e.amount || 0), 0); if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit === 0) { setError('Total Debit dan Kredit harus seimbang dan tidak boleh nol!'); return; } const completeEntries = entries.map(e => ({...e, description: commonDesc, date: commonDate})); onSave(completeEntries); } else { onSave([{accountId: simpleAccountId}], { kenaPpn, potongPph23, baseAmount: simpleAmount, desc: simpleDesc, date: simpleDate }); } };
    if (!isOpen) return null;
    return (<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"><div className="flex justify-between items-center p-4 border-b"><h2 className="text-xl font-semibold text-gray-800">{initialData ? 'Edit' : 'Tambah'} Transaksi</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button></div><div className="p-6 overflow-y-auto space-y-4">{!initialData && (<div className="flex justify-center bg-gray-100 p-1 rounded-lg"><button onClick={() => setIsJurnalUmum(false)} className={`w-1/2 py-2 rounded-md transition ${!isJurnalUmum ? 'bg-white shadow' : ''}`}>Form Sederhana</button><button onClick={() => setIsJurnalUmum(true)} className={`w-1/2 py-2 rounded-md transition ${isJurnalUmum ? 'bg-white shadow' : ''}`}>Jurnal Umum</button></div>)}{error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm font-medium">{error}</div>}{isJurnalUmum ? (<div className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="date" value={commonDate} onChange={e => setCommonDate(e.target.value)} className="w-full p-2 border rounded-md"/><input type="text" placeholder="Deskripsi Umum" value={commonDesc} onChange={e => setCommonDesc(e.target.value)} className="w-full p-2 border rounded-md"/></div>{entries.map((entry, index) => (<div key={index} className="grid grid-cols-12 gap-2 items-center"><select value={entry.accountId} onChange={e => handleEntryChange(index, 'accountId', e.target.value)} className="col-span-5 p-2 border rounded-md text-sm"><option value="">Pilih Akun</option>{allAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>)}</select><input type="number" placeholder="Jumlah" value={entry.amount || ''} onChange={e => handleEntryChange(index, 'amount', parseFloat(e.target.value))} className="col-span-4 p-2 border rounded-md text-sm"/><select value={entry.type} onChange={e => handleEntryChange(index, 'type', e.target.value)} className="col-span-2 p-2 border rounded-md text-sm"><option value="debit">Debit</option><option value="credit">Kredit</option></select><button onClick={() => removeEntry(index)} className="col-span-1 text-red-500 hover:text-red-700 disabled:opacity-50" disabled={entries.length <= 2}><Trash2 size={16}/></button></div>))}<button onClick={addEntry} className="text-sm text-blue-600 hover:underline">Tambah Baris</button></div>) : (<div className="space-y-4"><input type="date" value={simpleDate} onChange={e => setSimpleDate(e.target.value)} className="w-full p-2 border rounded-md"/><input type="text" placeholder="Deskripsi Transaksi" value={simpleDesc} onChange={e => setSimpleDesc(e.target.value)} className="w-full p-2 border rounded-md"/><input type="number" placeholder="Jumlah (sebelum pajak)" value={simpleAmount || ''} onChange={e => setSimpleAmount(parseFloat(e.target.value))} className="w-full p-2 border rounded-md"/><select value={simpleAccountId} onChange={e => setSimpleAccountId(e.target.value)} className="w-full p-2 border rounded-md"><option value="">Pilih Akun Pendapatan/Beban</option>{allAccounts.filter(a => a.category === 'income' || a.category === 'expense').map(acc => <option key={acc.id} value={acc.id}>{acc.id} - {acc.name}</option>)}</select>{transactionNature === 'income' && (<div className="flex items-center space-x-2"><input type="checkbox" id="kenaPpn" checked={kenaPpn} onChange={e => setKenaPpn(e.target.checked)}/><label htmlFor="kenaPpn">Kena PPN (11%)</label></div>)}{transactionNature === 'expense' && (<div className="flex items-center space-x-2"><input type="checkbox" id="potongPph23" checked={potongPph23} onChange={e => setPotongPph23(e.target.checked)}/><label htmlFor="potongPph23">Potong PPh 23 (2%) untuk Jasa</label></div>)}</div>)}</div><div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300">Batal</button><button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Simpan</button></div></div></div>);
};

// --- NEW: Company Management Components ---
const CompanySelector: FC<{ onSelectCompany: (company: Company) => void; supabase: SupabaseClient | null }> = ({ onSelectCompany, supabase }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [companyToDuplicate, setCompanyToDuplicate] = useState<Company | null>(null);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

    const fetchCompanies = useCallback(async () => {
        if (!supabase) return;
        setIsLoading(true);
        const { data, error } = await supabase.from('companies').select('*').order('name');
        if (error) {
            setError(`Gagal memuat perusahaan: ${error.message}`);
        } else {
            setCompanies(data.map((c: any) => ({
                id: c.id,
                name: c.name,
                address: c.address,
                phone: c.phone,
                npwp: c.npwp,
                fiscalYearStart: c.fiscal_year_start,
                fiscalYearEnd: c.fiscal_year_end,
            })));
        }
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchCompanies();
        if (supabase) {
            const channel = supabase.channel('companies-db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => fetchCompanies()).subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [supabase, fetchCompanies]);

    const handleSaveCompany = async (company: Company) => {
        if (!supabase || !company.name) return;
        const payload = { 
            name: company.name,
            address: company.address,
            phone: company.phone,
            npwp: company.npwp,
            fiscal_year_start: company.fiscalYearStart,
            fiscal_year_end: company.fiscalYearEnd,
        };
        const { error } = editingCompany 
            ? await supabase.from('companies').update(payload).eq('id', editingCompany.id)
            : await supabase.from('companies').insert(payload);
        
        if (error) { setError(`Gagal menyimpan: ${error.message}`); } 
        else { setIsModalOpen(false); setEditingCompany(null); }
    };

    const handleDuplicateCompany = async (originalCompany: Company, newName: string) => {
        if (!supabase || !newName) return;
        setIsLoading(true);
        setError(null);
        try {
            const nextYear = new Date(originalCompany.fiscalYearEnd || new Date()).getFullYear() + 1;
            const newCompanyPayload = {
                name: newName,
                address: originalCompany.address,
                phone: originalCompany.phone,
                npwp: originalCompany.npwp,
                fiscal_year_start: `${nextYear}-01-01`,
                fiscal_year_end: `${nextYear}-12-31`,
            };
            const { data: newCompanyData, error: newCompanyError } = await supabase.from('companies').insert(newCompanyPayload).select().single();
            if (newCompanyError) throw newCompanyError;

            const { data: originalAccounts, error: accountsError } = await supabase.from('accounts').select('id, name, category, normal_balance').eq('company_id', originalCompany.id);
            if (accountsError) throw accountsError;

            if (originalAccounts && originalAccounts.length > 0) {
                const newAccounts = originalAccounts.map(acc => ({ ...acc, company_id: newCompanyData.id }));
                const { error: insertAccountsError } = await supabase.from('accounts').insert(newAccounts);
                if (insertAccountsError) {
                    await supabase.from('companies').delete().eq('id', newCompanyData.id);
                    throw insertAccountsError;
                }
            }
            setCompanyToDuplicate(null);
        } catch (err: any) {
            setError(`Gagal menduplikasi: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDeleteCompany = async () => {
        if (!supabase || !companyToDelete) return;
        setIsLoading(true);
        const { error } = await supabase.from('companies').delete().eq('id', companyToDelete.id);
        if (error) setError(`Gagal menghapus: ${error.message}`);
        setCompanyToDelete(null);
        setIsLoading(false);
    };
    
    if (isLoading) return <div className="h-screen w-screen flex justify-center items-center bg-slate-100"><Loader2 className="animate-spin text-blue-600" size={48}/></div>
    
    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">Manajer Perusahaan</h1>
                    <p className="text-gray-500 mt-1">Pilih perusahaan untuk mulai mengelola pembukuan.</p>
                </div>
                 {error && <div className="p-3 my-4 rounded-lg text-sm bg-red-100 text-red-800">{error}</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map(company => (
                        <div key={company.id} className="bg-white rounded-xl shadow-md transition-all flex flex-col hover:shadow-lg hover:-translate-y-1">
                            <div onClick={() => onSelectCompany(company)} className="p-6 text-center flex-grow cursor-pointer">
                                <Building size={40} className="text-blue-500 mb-4 mx-auto"/>
                                <h2 className="font-semibold text-gray-800">{company.name}</h2>
                                <p className="text-xs text-gray-400 mt-1">{formatDate(company.fiscalYearStart)} - {formatDate(company.fiscalYearEnd)}</p>
                            </div>
                            <div className="border-t p-2 flex justify-around bg-gray-50 rounded-b-xl">
                                <button onClick={(e) => { e.stopPropagation(); setEditingCompany(company); setIsModalOpen(true); }} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="Edit"><Edit size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setCompanyToDuplicate(company); }} className="p-2 text-gray-500 hover:text-green-600 transition-colors" title="Duplikasi"><Copy size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setCompanyToDelete(company); }} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Hapus"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                     <div onClick={() => { setEditingCompany(null); setIsModalOpen(true); }} className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer flex flex-col items-center justify-center text-gray-500 hover:text-blue-600">
                        <Plus size={40} className="mb-4"/>
                        <h2 className="font-semibold">Tambah Perusahaan</h2>
                    </div>
                </div>
            </div>
            {isModalOpen && <CompanyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCompany} existingCompany={editingCompany} />}
            {companyToDuplicate && <DuplicateCompanyModal isOpen={!!companyToDuplicate} onClose={() => setCompanyToDuplicate(null)} onConfirm={handleDuplicateCompany} company={companyToDuplicate} />}
            {companyToDelete && <ConfirmationModal isOpen={!!companyToDelete} onClose={() => setCompanyToDelete(null)} onConfirm={handleDeleteCompany} title="Hapus Perusahaan?" message={`Anda yakin ingin menghapus "${companyToDelete.name}"? Semua data akun dan transaksi yang terkait akan dihapus permanen.`} />}
        </div>
    );
};

const CompanyModal: FC<{isOpen: boolean; onClose: () => void; onSave: (company: Company) => Promise<void>; existingCompany: Company | null;}> = ({ isOpen, onClose, onSave, existingCompany }) => {
    const [company, setCompany] = useState<Company>(existingCompany || { id: '', name: '' });
    useEffect(() => { setCompany(existingCompany || { id: '', name: '', fiscalYearStart: `${new Date().getFullYear()}-01-01`, fiscalYearEnd: `${new Date().getFullYear()}-12-31` }); }, [existingCompany]);
    
    const handleChange = (field: keyof Company, value: string) => setCompany(prev => ({...prev, [field]: value}));

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between items-center p-4 border-b"><h2 className="text-xl font-semibold text-gray-800">{existingCompany ? 'Edit' : 'Tambah'} Perusahaan</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button></div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div><label className="block text-sm font-medium text-gray-700">Nama Perusahaan</label><input type="text" value={company.name} onChange={e => handleChange('name', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div><label className="block text-sm font-medium text-gray-700">Alamat</label><textarea value={company.address || ''} onChange={e => handleChange('address', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700">Telepon</label><input type="text" value={company.phone || ''} onChange={e => handleChange('phone', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">NPWP</label><input type="text" value={company.npwp || ''} onChange={e => handleChange('npwp', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium text-gray-700">Tgl Mulai Periode Fiskal</label><input type="date" value={company.fiscalYearStart || ''} onChange={e => handleChange('fiscalYearStart', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                        <div><label className="block text-sm font-medium text-gray-700">Tgl Akhir Periode Fiskal</label><input type="date" value={company.fiscalYearEnd || ''} onChange={e => handleChange('fiscalYearEnd', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                    </div>
                </div>
                <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300">Batal</button><button onClick={() => onSave(company)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Simpan</button></div>
            </div>
        </div>
    )
};

const DuplicateCompanyModal: FC<{isOpen: boolean; onClose: () => void; onConfirm: (originalCompany: Company, newName: string) => Promise<void>; company: Company | null;}> = ({ isOpen, onClose, onConfirm, company }) => {
    const [newName, setNewName] = useState('');
    useEffect(() => { if (company) { setNewName(`${company.name} (Copy)`); } }, [company]);
    if (!isOpen || !company) return null;
    const handleConfirm = () => { if (newName.trim()) { onConfirm(company, newName.trim()); } };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b"><h2 className="text-xl font-semibold text-gray-800">Duplikasi Perusahaan</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle size={24} /></button></div>
                <div className="p-6 space-y-4"><p className="text-sm text-gray-600">Anda akan membuat salinan dari <strong>{company.name}</strong>. Ini akan menduplikasi <strong>Daftar Akun</strong> dan detail perusahaan, bukan riwayat transaksinya.</p><div><label className="block text-sm font-medium text-gray-700">Nama Perusahaan Baru</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div></div>
                <div className="flex justify-end p-4 border-t bg-gray-50 rounded-b-lg"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md mr-2 hover:bg-gray-300">Batal</button><button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Buat Duplikat</button></div>
            </div>
        </div>
    );
};



// --- Main Accounting Workspace Component ---
type ActiveTab = 'dashboard' | 'transactions' | 'reports' | 'ledger' | 'accounts' | 'journal';

const AccountingWorkspace: FC<{ company: Company; onBack: () => void; supabase: SupabaseClient }> = ({ company, onBack, supabase }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isJurnalUmum, setIsJurnalUmum] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction[] | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'transaction' | 'account', id: string } | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);


    const fetchData = useCallback(async () => {
    try {
        setError(null);
        setLoading(true);
        const { data: accountsData, error: accountsError } = await supabase.from('accounts').select('*').eq('company_id', company.id).order('id');
        if (accountsError) throw accountsError;

        const { data: transactionsData, error: transactionsError } = await supabase.from('transactions').select('*').eq('company_id', company.id).order('date', { ascending: false });
        if (transactionsError) throw transactionsError;
        
        setAccounts(accountsData.map((a: any) => ({
            id: a.id,
            name: a.name,
            category: a.category,
            normalBalance: a.normal_balance,
            beginningBalance: a.beginning_balance // Ini baris penting yang mengambil saldo awal
        })) as Account[]);
        
        setTransactions(transactionsData.map((t: any) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            accountId: t.account_id,
            type: t.type,
            amount: t.amount
        })) as Transaction[]);

    } catch (err: any) {
        setError(`Gagal memuat data: ${err.message}`);
    } finally {
        setLoading(false);
    }
    }, [supabase, company.id]);

    useEffect(() => {
        fetchData();
        const channel = supabase.channel(`company-${company.id}-db-changes`).on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [company.id, fetchData, supabase]);
    
    const filteredTransactions = useMemo(() => transactions.filter(tx => tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || getAccountName(tx.accountId, accounts).toLowerCase().includes(searchTerm.toLowerCase())), [transactions, searchTerm, accounts]);
    
    const handleDeleteRequest = useCallback((type: 'transaction' | 'account', id: string) => { setItemToDelete({ type, id }); setIsConfirmModalOpen(true); }, []);
    
    const handleDeleteConfirm = useCallback(async () => {
        if (!itemToDelete) return;
        let error;
        if (itemToDelete.type === 'transaction') {
            ({ error } = await supabase.from('transactions').delete().eq('id', itemToDelete.id));
        } else if (itemToDelete.type === 'account') {
            ({ error } = await supabase.from('accounts').delete().match({ id: itemToDelete.id, company_id: company.id }));
        }
        if(error) setError(`Gagal menghapus: ${error.message}`);
        setItemToDelete(null);
    }, [itemToDelete, supabase, company.id]);
    
    const handleOpenEditTxModal = useCallback((txToEdit: Transaction) => { const related = transactions.filter(t => t.description === txToEdit.description && t.date === txToEdit.date); setEditingTransaction(related.length > 1 ? related : [txToEdit]); setIsJurnalUmum(true); setIsTxModalOpen(true); }, [transactions]);
    const handleOpenNewTxModal = useCallback(() => { setEditingTransaction(null); setIsTxModalOpen(true); setIsJurnalUmum(false); }, []);
    const handleCloseTxModal = useCallback(() => { setIsTxModalOpen(false); setEditingTransaction(null); }, []);
    
    const handleSaveTransaction = useCallback(async (entries: Partial<Transaction>[], options?: { kenaPpn?: boolean; potongPph23?: boolean; baseAmount?: number; desc?: string; date?: string }) => {
        let transactionsToInsert: Omit<Transaction, 'id'>[] = [];
        if (options && !isJurnalUmum) {
            const { kenaPpn, potongPph23, baseAmount, desc, date } = options;
            if(!baseAmount || !desc || !date || !entries[0]?.accountId) { setError("Data form sederhana tidak lengkap."); return; }
            const primaryAccount = accounts.find(acc => acc.id === entries[0].accountId);
            if (!primaryAccount) { setError("Akun utama tidak ditemukan."); return; }
    
            if(primaryAccount.category === 'income') {
                const ppnAmount = kenaPpn ? baseAmount * PPN_RATE : 0;
                transactionsToInsert.push({ date, description: desc, accountId: '1-1200', type: 'debit', amount: baseAmount + ppnAmount });
                transactionsToInsert.push({ date, description: desc, accountId: entries[0].accountId, type: 'credit', amount: baseAmount });
                if(kenaPpn) { transactionsToInsert.push({ date, description: `PPN atas ${desc}`, accountId: '2-1250', type: 'credit', amount: ppnAmount }); }
            } else if (primaryAccount.category === 'expense') {
                const pph23Amount = potongPph23 ? baseAmount * PPH23_RATE : 0;
                transactionsToInsert.push({ date, description: desc, accountId: entries[0].accountId, type: 'debit', amount: baseAmount });
                transactionsToInsert.push({ date, description: `Kas untuk ${desc}`, accountId: '1-1130', type: 'credit', amount: baseAmount - pph23Amount });
                if (potongPph23) { transactionsToInsert.push({ date, description: `PPh 23 atas ${desc}`, accountId: '2-1260', type: 'credit', amount: pph23Amount }); }
            }
        } else {
            transactionsToInsert = entries.map(e => ({ date: e.date!, description: e.description!, accountId: e.accountId!, type: e.type!, amount: e.amount! }));
        }
        
        const dbPayload = transactionsToInsert.map(tx => ({ company_id: company.id, date: tx.date, description: tx.description, account_id: tx.accountId, type: tx.type, amount: tx.amount }));
        if (dbPayload.length === 0) { handleCloseTxModal(); return; }

        const { error } = await supabase.from('transactions').insert(dbPayload);
        if(error) setError(`Gagal menyimpan transaksi: ${error.message}`);
        else handleCloseTxModal();
    }, [isJurnalUmum, accounts, handleCloseTxModal, supabase, company.id]);
    


    const handleSaveAccount = useCallback(async (account: Account) => { 
    const { id, name, category, normalBalance, beginningBalance } = account; // Ambil beginningBalance
    const dbAccount = { 
        id, 
        name, 
        category, 
        normal_balance: normalBalance, 
        beginning_balance: beginningBalance, // Tambahkan ke payload
        company_id: company.id 
    };
    const { error } = await supabase.from('accounts').upsert(dbAccount, { onConflict: 'id,company_id' });
    if(error) setError(`Gagal menyimpan akun: ${error.message}`);
    }, [supabase, company.id]);

    const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        // Logika import file Anda ada di sini
    }, [supabase, accounts, company.id]);

    const handleConfirmImport = () => {
        setIsImportModalOpen(false);
        fileInputRef.current?.click();
    };
    
    const handleDownloadTemplate = useCallback(async () => {
       // Logika download template Anda ada di sini
    }, []);

    const handleExportTransactions = useCallback(async () => {
       // Logika ekspor transaksi Anda ada di sini
    }, [filteredTransactions, accounts]);
    
    const TabButton: FC<{ tabName: ActiveTab, label: string }> = ({ tabName, label }) => (<button onClick={() => setActiveTab(tabName)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tabName ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-blue-100'}`}>{label}</button>);

    if (loading) return <div className="h-screen w-screen flex justify-center items-center bg-slate-100"><Loader2 className="animate-spin text-blue-600" size={48}/></div>
    if (error) return <div className="h-screen w-screen flex flex-col justify-center items-center bg-red-50 text-red-700 p-4"><XCircle size={48} className="mb-4"/><h1 className="text-xl font-bold">Terjadi Kesalahan</h1><p className="text-center mt-2">{error}</p></div>
    
    return (
         <div className="bg-slate-100 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft size={20} className="text-gray-600" /></button>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{company.name}</h1>
                            <p className="text-gray-500 mt-1">{company.address || 'Detail Perusahaan'}</p>
                        </div>
                    </div>
                     <nav className="flex space-x-2 mt-4 sm:mt-0 bg-white p-1 rounded-lg shadow-sm flex-wrap justify-center">
                        <TabButton tabName="dashboard" label="Dasbor" />
                        <TabButton tabName="transactions" label="Transaksi" />
                        <TabButton tabName="journal" label="Jurnal Umum" />
                        <TabButton tabName="ledger" label="Buku Besar" />
                        <TabButton tabName="reports" label="Laporan" />
                        <TabButton tabName="accounts" label="Manajemen Akun" />
                    </nav>
                </header>
                <main>
                    {activeTab === 'dashboard' && <Dashboard transactions={transactions} accounts={accounts} />}
                    {activeTab === 'transactions' && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="relative w-full md:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} /><input type="text" placeholder="Cari transaksi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"/></div>
                                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx, .xls, .csv"/>
                                    <button onClick={handleDownloadTemplate} className="w-full sm:w-auto flex items-center justify-center bg-gray-500 text-white px-3 py-2 text-sm rounded-lg shadow hover:bg-gray-600 transition-colors"><FileDown size={16} className="mr-2" />Template</button>
                                    <button onClick={() => setIsImportModalOpen(true)} disabled={isImporting} className="w-full sm:w-auto flex items-center justify-center bg-teal-600 text-white px-3 py-2 text-sm rounded-lg shadow hover:bg-teal-700 transition-colors disabled:bg-gray-400">
                                        {isImporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />} Impor Data
                                    </button>
                                    <button onClick={handleExportTransactions} className="w-full sm:w-auto flex items-center justify-center bg-green-600 text-white px-3 py-2 text-sm rounded-lg shadow hover:bg-green-700 transition-colors"><Download size={16} className="mr-2" />Ekspor Data</button>
                                    <button onClick={handleOpenNewTxModal} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white px-3 py-2 text-sm rounded-lg shadow hover:bg-blue-700 transition-colors"><Plus size={16} className="mr-2" />Tambah</button>
                                </div>
                            </div>
                            {importStatus && (<div className={`p-3 rounded-lg text-sm ${importStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{importStatus.message}</div>)}
                            <TransactionTable transactions={filteredTransactions} accounts={accounts} onEdit={handleOpenEditTxModal} onDeleteRequest={(id) => handleDeleteRequest('transaction', id)} />
                        </div>
                    )}
                    {activeTab === 'journal' && <JurnalUmum company={company} transactions={transactions} accounts={accounts} />}
                    {activeTab === 'reports' && <Reports company={company} transactions={transactions} accounts={accounts} />}
                    {activeTab === 'ledger' && <GeneralLedger company={company} transactions={transactions} accounts={accounts} />}
                    {activeTab === 'accounts' && <AccountManagement company={company} accounts={accounts} transactions={transactions} onSave={handleSaveAccount} onDeleteRequest={(id) => handleDeleteRequest('account', id)} />}
                </main>
            </div>
            {isTxModalOpen && (<TransactionModal isOpen={isTxModalOpen} onClose={handleCloseTxModal} onSave={handleSaveTransaction} initialData={editingTransaction} isJurnalUmum={isJurnalUmum} setIsJurnalUmum={setIsJurnalUmum} allAccounts={accounts}/>)}
            <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={handleDeleteConfirm} title={`Konfirmasi Hapus ${itemToDelete?.type === 'account' ? 'Akun' : 'Transaksi'}`} message={`Apakah Anda yakin ingin menghapus ${itemToDelete?.type === 'account' ? 'akun' : 'transaksi'} ini? Tindakan ini tidak dapat diurungkan.`} />
            <ImportConfirmationModal 
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onConfirm={handleConfirmImport}
            />
        </div>
    );
};


// --- App Entry Point ---
const App: FC = () => {
    const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const scriptId = 'supabase-script';
        if (document.getElementById(scriptId)) { if (window.supabase) { setSupabase(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)); } return; }
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = () => { if (window.supabase) { setSupabase(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)); } else { setError("Gagal memuat Supabase client."); }};
        script.onerror = () => { setError("Gagal memuat skrip Supabase dari CDN."); };
        document.body.appendChild(script);
        return () => { const el = document.getElementById(scriptId); if (el) { document.body.removeChild(el); }};
    }, []);
    
    if (error) { return <div className="h-screen w-screen flex flex-col justify-center items-center bg-red-50 text-red-700 p-4"><XCircle size={48} className="mb-4"/><h1 className="text-xl font-bold">Terjadi Kesalahan Kritis</h1><p className="text-center mt-2">{error}</p></div>; }
    if (!supabase) { return <div className="h-screen w-screen flex justify-center items-center bg-slate-100"><Loader2 className="animate-spin text-blue-600" size={48}/></div>; }

    if (selectedCompany) {
        return <AccountingWorkspace company={selectedCompany} onBack={() => setSelectedCompany(null)} supabase={supabase} />;
    }
    
    return <CompanySelector onSelectCompany={setSelectedCompany} supabase={supabase} />;
};

export default App;
