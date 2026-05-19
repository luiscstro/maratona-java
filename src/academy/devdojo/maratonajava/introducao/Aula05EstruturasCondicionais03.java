package academy.devdojo.maratonajava.introducao;

public class Aula05EstruturasCondicionais03 {
    static void main(String[] args) {
        double salario = 500;
        // (condicao) ? verdadeiro : falso
        String resultado = salario > 5000 ? "Eu vou doar 500 pro DevDojo" : "Ainda não tenho condições, mas vou ter";
        boolean possoComprar = salario >= 500 ? true : false;
        System.out.println(resultado);
        System.out.println(possoComprar);
    }
}
