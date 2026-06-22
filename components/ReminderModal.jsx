import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleDailyReminder, cancelDailyReminder } from '@/lib/notifications';
import { Colors, Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export const REMINDER_KEY = 'reminder_config';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function to12h(hour24) {
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  const h = hour24 % 12 || 12;
  return { h, ampm };
}

function to24h(h, ampm) {
  if (ampm === 'AM') return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

export function formatReminderTime(hour24, minute) {
  const { h, ampm } = to12h(hour24);
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

export default function ReminderModal({ visible, onClose }) {
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [hour24, setHour24] = useState(20);
  const [minute, setMinute] = useState(0);
  const [selH, setSelH] = useState(8);
  const [selM, setSelM] = useState(0);
  const [selAmpm, setSelAmpm] = useState('PM');

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(REMINDER_KEY).then(stored => {
      if (stored) {
        const cfg = JSON.parse(stored);
        setEnabled(cfg.enabled ?? false);
        setHour24(cfg.hour ?? 20);
        setMinute(cfg.minute ?? 0);
        const { h, ampm } = to12h(cfg.hour ?? 20);
        setSelH(h);
        setSelM(cfg.minute ?? 0);
        setSelAmpm(ampm);
      }
    });
  }, [visible]);

  async function toggleEnabled(val) {
    setEnabled(val);
    if (val) await scheduleDailyReminder(hour24, minute);
    else await cancelDailyReminder();
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled: val, hour: hour24, minute }));
  }

  async function confirm() {
    const h24 = to24h(selH, selAmpm);
    setHour24(h24);
    setMinute(selM);
    if (enabled) await scheduleDailyReminder(h24, selM);
    await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify({ enabled, hour: h24, minute: selM }));
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.bg }]}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.title, { color: colors.textPrimary }]}>Recordatorio diario</Text>

          <View style={[s.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[s.toggleLabel, { color: colors.textPrimary }]}>Recuérdame publicar</Text>
              <Text style={[s.toggleSub, { color: colors.textMuted }]}>Notificación diaria</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {enabled && (
            <>
              <Text style={[s.pickerLabel, { color: colors.textMuted }]}>HORA DEL RECORDATORIO</Text>
              <View style={s.columns}>
                {/* Horas */}
                <View style={{ flex: 1 }}>
                  <Text style={s.colLabel}>Hora</Text>
                  <FlatList
                    data={HOURS_12}
                    keyExtractor={String}
                    style={s.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[s.item, selH === item && s.itemSel]}
                        onPress={() => setSelH(item)}>
                        <Text style={[s.itemText, selH === item && s.itemTextSel]}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>

                <Text style={[s.colon, { color: colors.textPrimary }]}>:</Text>

                {/* Minutos */}
                <View style={{ flex: 1 }}>
                  <Text style={s.colLabel}>Min</Text>
                  <FlatList
                    data={MINUTES}
                    keyExtractor={String}
                    style={s.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[s.item, selM === item && s.itemSel]}
                        onPress={() => setSelM(item)}>
                        <Text style={[s.itemText, selM === item && s.itemTextSel]}>
                          {String(item).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>

                {/* AM/PM */}
                <View style={s.ampmCol}>
                  <Text style={s.colLabel}>  </Text>
                  {['AM', 'PM'].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[s.ampmBtn, selAmpm === p && s.ampmBtnSel]}
                      onPress={() => setSelAmpm(p)}>
                      <Text style={[s.ampmText, selAmpm === p && s.ampmTextSel]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={s.btnRow}>
            <TouchableOpacity style={[s.cancelBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onClose}>
              <Text style={[s.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
              <LinearGradient colors={colors.gradientPrimary} style={s.confirmGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.confirmText}>Guardar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, marginBottom: 20 },
  toggleLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  toggleSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  pickerLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 20 },
  colLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  colon: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: 28 },
  list: { maxHeight: 180 },
  item: { paddingVertical: 10, borderRadius: Radius.sm, alignItems: 'center' },
  itemSel: { backgroundColor: 'rgba(155,109,214,0.12)' },
  itemText: { color: Colors.textSecondary, fontSize: 16 },
  itemTextSel: { color: Colors.primary, fontWeight: '700' },
  ampmCol: { justifyContent: 'center', gap: 8, paddingTop: 22 },
  ampmBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  ampmBtnSel: { backgroundColor: 'rgba(155,109,214,0.12)', borderColor: Colors.primary },
  ampmText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  ampmTextSel: { color: Colors.primary },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: Radius.pill, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  cancelText: { color: Colors.textSecondary, fontWeight: '600' },
  confirmBtn: { flex: 1, borderRadius: Radius.pill, overflow: 'hidden' },
  confirmGrad: { padding: 14, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
