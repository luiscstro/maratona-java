package academy.devdojo.maratonajava.introducao;

/**
 * Prática
 * Crie variáveis para os campos descritos abaixo entre <> e imprima a seguinte mensagem:
 *
 * Eu <nome>, morando no endereõ <endereço>,
 * confirmo que recebi o salário de <salarário>, na data <data></data></salarário></endereço></nome></>
 */
public class Aula03TiposPrimitivosExercicio {
    static void main(String[] args) {
        String nome = "Luis Felipe";
        String endereco = "Avenida Neiva Moreira, 200";
        double salario = 2000.13;
        String data = "15/05/2026";
        System.out.println("Eu "+nome+", morando no endereço: "+endereco+", confirmo que recebi o salário de "+salario+", na data "+data);
    }
}
