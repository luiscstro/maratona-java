package academy.devdojo.maratonajava.introducao;

public class Aula02TiposPrimitivos {
    static void main(String[] args) {
        // int, double, float, char, byte, short, long, boolean (letras minúsculas sempre)
        int idade = (int) 10L;
        long numeroGrande = 10000;
        double salarioDoble = 2000.0;
        float salarioFloat = (float) 2500.0D;
        byte idadeByte = 10;
        short idadeShort= 10;
        boolean verdadeiro = true;
        boolean falso = false;
        char caractere = 'M';
        String nome = "Papigaquigrafo";
        System.out.println("A idade é "+idade+" anos");
        System.out.println(falso);
        System.out.println("char " + caractere);
        System.out.println(numeroGrande);
        System.out.println(nome);
    }
}
