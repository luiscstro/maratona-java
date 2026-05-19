package academy.devdojo.maratonajava.introducao;

public class Aula05EstruturasCondicionais05 {
    static void main(String[] args) {
        double salario = 25000;
        double faixa1 = 9.70/100;
        double faixa2 = 37.35/100;
        double faixa3 = 49.50/100;
        double valorImposto;
        if (salario <= 34712){
            valorImposto = salario * faixa1;
        } else if (salario >= 34713 && salario <= 68507) {
            valorImposto = salario * faixa2;
        }else {
            valorImposto = salario * faixa3;
        }
        System.out.println(valorImposto);

    }
}
