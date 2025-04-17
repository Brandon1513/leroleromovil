import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";

export const homeStyle = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
        paddingTop: 60,
        paddingHorizontal: 16
      },
      title: {
        fontSize: 25,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
        textAlign: 'center'
      },
      grid: {
        gap: 16,
        alignItems: 'center'
      },
      card: {
        backgroundColor: Colors.light.background,
        borderRadius: 16,
        padding: 24,
        margin: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: '42%',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3
      },
      label: {
        marginTop: 12,
        fontSize: 15,
        fontWeight: '800',
        color: Colors.light.text,
      }
})